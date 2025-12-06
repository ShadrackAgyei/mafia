import { Server, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager.js';
import { GameEngine } from '../services/GameEngine.js';
import {
  NightActionPayload,
  DayVotePayload,
  ActionSubmittedData,
  ActionErrorData,
  NightResultsData,
  InvestigationResultData,
  VoteUpdatedData,
  DayResultsData,
  PhaseChangedData,
  GameEndedData,
  PlayerDiedData,
} from '../../../shared/types/index.js';

/**
 * Setup game-related Socket.IO event handlers
 */
export function setupGameHandlers(io: Server, socket: Socket): void {
  /**
   * Submit night action (kill, save, investigate)
   */
  socket.on('game:night_action', async (payload: NightActionPayload) => {
    try {
      const { roomCode, action, targetId } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      const gameState = await GameEngine.getGameState(roomCode);
      if (!gameState) return;

      // Validate phase
      if (gameState.phase !== 'night') {
        socket.emit('game:action_error', {
          code: 'WRONG_PHASE',
          message: 'Can only perform night actions during night phase',
        } as ActionErrorData);
        return;
      }

      // Submit action
      try {
        await GameEngine.submitNightAction(gameState, player.id, action, targetId);

        const targetPlayer = room.players.find((p) => p.id === targetId);

        socket.emit('game:action_submitted', {
          action,
          targetId,
          targetName: targetPlayer?.name || 'Unknown',
        } as ActionSubmittedData);

        console.log(`[Game] ${player.name} submitted ${action} on ${targetPlayer?.name}`);

        // Check if all actions submitted
        if (GameEngine.areAllNightActionsSubmitted(gameState)) {
          console.log(`[Game] All night actions submitted in room ${roomCode}`);

          // Process night actions
          const { killed, saved } = await GameEngine.processNightActions(gameState);

          // Transition to night results
          const newState = await GameEngine.transitionPhase(gameState, room.settings);

          // Notify all players of results
          const killedPlayer = killed ? room.players.find((p) => p.id === killed) : null;

          io.to(roomCode).emit('game:night_results', {
            killed: killedPlayer
              ? {
                  playerId: killedPlayer.id,
                  playerName: killedPlayer.name,
                  role: gameState.roles[killedPlayer.id],
                }
              : null,
            saved,
            round: newState.round,
          } as NightResultsData);

          // Send investigation result to detective if applicable
          const investigationResult = GameEngine.getInvestigationResult(gameState);
          if (investigationResult) {
            const detective = room.players.find(
              (p) => gameState.roles[p.id] === 'detective'
            );
            if (detective) {
              const targetPlayer = room.players.find((p) => p.id === investigationResult.targetId);
              io.to(detective.socketId).emit('game:investigation_result', {
                targetId: investigationResult.targetId,
                targetName: targetPlayer?.name || 'Unknown',
                role: investigationResult.role,
              } as InvestigationResultData);
            }
          }

          // Auto-transition to day discussion after delay
          setTimeout(async () => {
            const currentState = await GameEngine.getGameState(roomCode);
            if (currentState && currentState.phase === 'night_results') {
              const nextState = await GameEngine.transitionPhase(currentState, room.settings);

              io.to(roomCode).emit('game:phase_changed', {
                phase: nextState.phase,
                round: nextState.round,
                duration: room.settings.dayDuration,
                endsAt: nextState.phaseEndsAt,
              } as PhaseChangedData);
            }
          }, 3000); // 3 seconds
        }
      } catch (error: any) {
        socket.emit('game:action_error', {
          code: 'INVALID_ACTION',
          message: error.message,
        } as ActionErrorData);
      }
    } catch (error: any) {
      console.error('[Game] Error submitting night action:', error);
    }
  });

  /**
   * Submit day vote
   */
  socket.on('game:day_vote', async (payload: DayVotePayload) => {
    try {
      const { roomCode, targetId } = payload;

      const room = await RoomManager.getRoom(roomCode);
      if (!room) return;

      const player = RoomManager.getPlayerBySocket(room, socket.id);
      if (!player) return;

      const gameState = await GameEngine.getGameState(roomCode);
      if (!gameState) return;

      // Validate phase
      if (gameState.phase !== 'day_voting') {
        socket.emit('game:action_error', {
          code: 'WRONG_PHASE',
          message: 'Can only vote during voting phase',
        } as ActionErrorData);
        return;
      }

      // Submit vote
      try {
        await GameEngine.submitDayVote(gameState, player.id, targetId);

        const targetPlayer = targetId !== 'skip' ? room.players.find((p) => p.id === targetId) : null;

        console.log(
          `[Game] ${player.name} voted for ${targetPlayer?.name || 'SKIP'} in room ${roomCode}`
        );

        // Get current vote counts
        const voteCounts = GameEngine.getCurrentVoteCounts(gameState);
        const hasVoted = GameEngine.getPlayersWhoVoted(gameState);

        // Notify all players of updated votes
        io.to(roomCode).emit('game:vote_updated', {
          votes: voteCounts,
          hasVoted,
          totalVotes: hasVoted.length,
          requiredVotes: gameState.alive.length,
        } as VoteUpdatedData);

        // Check if all players voted
        if (GameEngine.areAllDayVotesSubmitted(gameState)) {
          console.log(`[Game] All day votes submitted in room ${roomCode}`);

          // Process votes
          const { eliminated, votingResults } = await GameEngine.processDayVotes(gameState);

          // Transition to day results
          const newState = await GameEngine.transitionPhase(gameState, room.settings);

          // Notify all players of results
          const eliminatedPlayer = eliminated ? room.players.find((p) => p.id === eliminated) : null;

          io.to(roomCode).emit('game:day_results', {
            eliminated: eliminatedPlayer
              ? {
                  playerId: eliminatedPlayer.id,
                  playerName: eliminatedPlayer.name,
                  role: gameState.roles[eliminatedPlayer.id],
                  votes: votingResults[eliminatedPlayer.id]?.votes || 0,
                }
              : null,
            votingResults,
            round: newState.round,
          } as DayResultsData);

          // Check win condition
          const winner = GameEngine.checkWinCondition(newState);

          if (winner) {
            // Game over
            await GameEngine.transitionPhase(newState, room.settings);
            await RoomManager.updateRoomStatus(roomCode, 'finished');

            // Calculate game stats
            const endedData: GameEndedData = {
              winner: winner.team,
              reason: winner.reason,
              rounds: newState.round,
              duration: Math.floor(
                (new Date().getTime() - new Date(room.createdAt).getTime()) / 1000
              ),
              players: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                role: newState.roles[p.id],
                survived: newState.alive.includes(p.id),
                killedRound: newState.dead.includes(p.id)
                  ? newState.history.find((e) => e.target === p.id && (e.type === 'kill' || e.type === 'elimination'))
                      ?.round
                  : undefined,
                killedBy: newState.dead.includes(p.id)
                  ? newState.history.find((e) => e.target === p.id && (e.type === 'kill' || e.type === 'elimination'))
                      ?.type === 'kill'
                    ? 'mafia'
                    : 'vote'
                  : undefined,
                won:
                  (winner.team === 'mafia' && newState.roles[p.id] === 'mafia') ||
                  (winner.team === 'villagers' && newState.roles[p.id] !== 'mafia'),
              })),
            };

            io.to(roomCode).emit('game:ended', endedData);

            console.log(`[Game] Game ended in room ${roomCode}, winner: ${winner.team}`);
          } else {
            // Continue to next round
            setTimeout(async () => {
              const currentState = await GameEngine.getGameState(roomCode);
              if (currentState && currentState.phase === 'day_results') {
                const nextState = await GameEngine.transitionPhase(currentState, room.settings);

                io.to(roomCode).emit('game:phase_changed', {
                  phase: nextState.phase,
                  round: nextState.round,
                  duration: room.settings.nightDuration,
                  endsAt: nextState.phaseEndsAt,
                } as PhaseChangedData);
              }
            }, 5000); // 5 seconds
          }
        }
      } catch (error: any) {
        socket.emit('game:action_error', {
          code: 'INVALID_ACTION',
          message: error.message,
        } as ActionErrorData);
      }
    } catch (error: any) {
      console.error('[Game] Error submitting day vote:', error);
    }
  });
}
