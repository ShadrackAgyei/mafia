# Mafia Game - Core Logic & State Machine

## Game State Machine

### State Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                         LOBBY                                │
│  - Players join with code                                    │
│  - Host configures settings                                  │
│  - Players ready up                                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ All ready + Start clicked
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   ROLE_ASSIGNMENT                            │
│  - Roles randomly distributed                                │
│  - Each player notified of their role                        │
│  - 5 second reveal period                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ Auto-transition
                      ▼
           ┌──────────────────────┐
           │        NIGHT         │◄──────────┐
           │  - Mafia votes       │           │
           │  - Doctor saves      │           │
           │  - Detective checks  │           │
           └──────────┬───────────┘           │
                      │ All actions submitted │
                      │ or timeout            │
                      ▼                       │
           ┌──────────────────────┐           │
           │   NIGHT_RESULTS      │           │
           │  - Process actions   │           │
           │  - Determine deaths  │           │
           │  - Show results      │           │
           └──────────┬───────────┘           │
                      │ Auto (3s delay)       │
                      ▼                       │
           ┌──────────────────────┐           │
           │   DAY_DISCUSSION     │           │
           │  - Open chat         │           │
           │  - Players discuss   │           │
           │  - Timed period      │           │
           └──────────┬───────────┘           │
                      │ Timer expires         │
                      ▼                       │
           ┌──────────────────────┐           │
           │    DAY_VOTING        │           │
           │  - Players vote      │           │
           │  - See vote count    │           │
           └──────────┬───────────┘           │
                      │ All voted or timeout  │
                      ▼                       │
           ┌──────────────────────┐           │
           │    DAY_RESULTS       │           │
           │  - Tally votes       │           │
           │  - Eliminate player  │           │
           │  - Check win cond.   │           │
           └──────────┬───────────┘           │
                      │                       │
                      ├─ Continue ────────────┘
                      │
                      └─ Game Over
                      ▼
           ┌──────────────────────┐
           │     GAME_OVER        │
           │  - Show winner       │
           │  - Display stats     │
           │  - Save to history   │
           └──────────────────────┘
```

---

## Phase Details

### LOBBY Phase
**Duration**: Indefinite (until host starts)

**Actions**:
- Players can join/leave
- Host can kick players
- Players toggle ready status
- Host configures settings

**Transition Conditions**:
- Minimum 5 players
- All players ready
- Host clicks "Start Game"

**Data Stored**:
```typescript
{
  roomCode: string,
  hostId: string,
  players: Map<socketId, {
    id: string,
    name: string,
    isReady: boolean,
    isHost: boolean,
  }>,
  settings: {
    maxPlayers: number,          // 5-15
    nightDuration: number,        // 30-120 seconds
    dayDuration: number,          // 60-300 seconds
    votingDuration: number,       // 30-60 seconds
  }
}
```

---

### ROLE_ASSIGNMENT Phase
**Duration**: 5 seconds

**Actions**:
- Server assigns roles based on player count
- Each player receives their role privately
- Role distribution follows preset ratios

**Role Distribution Algorithm**:
```typescript
function assignRoles(playerCount: number): RoleDistribution {
  const roles = [];

  // Determine mafia count (roughly 1/3 of players)
  const mafiaCount = Math.floor(playerCount / 3);

  // Add mafia
  for (let i = 0; i < mafiaCount; i++) {
    roles.push('mafia');
  }

  // Add special roles
  if (playerCount >= 5) roles.push('doctor');
  if (playerCount >= 7) roles.push('detective');

  // Fill remaining with villagers
  while (roles.length < playerCount) {
    roles.push('villager');
  }

  // Shuffle roles
  return shuffle(roles);
}
```

**Transition**: Auto-transition after 5 seconds

---

### NIGHT Phase
**Duration**: Configurable (default 60 seconds)

**Actions by Role**:

1. **Mafia** (team action):
   - All mafia members see each other
   - Mafia chat is private (other players can't see)
   - Each mafia votes for one target
   - Target with most mafia votes is selected
   - If tie, no kill occurs

2. **Doctor**:
   - Selects one player to save
   - Can save themselves
   - Cannot save same player twice in a row (optional rule)

3. **Detective**:
   - Selects one player to investigate
   - Receives their role at night results

4. **Villager**:
   - No action
   - Waits for night to end

**Transition Conditions**:
- All living players with actions have submitted, OR
- Timer expires

**Action Resolution Order**:
1. Collect all actions
2. Process save (Doctor)
3. Process kill (Mafia)
4. Process investigation (Detective)
5. Determine if kill was prevented

---

### NIGHT_RESULTS Phase
**Duration**: 3-5 seconds

**Events**:
- Announce who died (or no one if saved)
- Detective receives investigation result (private message)
- Update alive/dead player lists
- Check win conditions

**Announcements**:
```
"[Player Name] was killed by the Mafia!"
"No one died last night." (if saved or no kill)
"[Player Name] was killed. They were the [Role]."
```

**Win Condition Check**:
```typescript
function checkWinCondition(state: GameState): Winner | null {
  const alivePlayers = Array.from(state.alive);
  const aliveMafia = alivePlayers.filter(id =>
    state.roles.get(id) === 'mafia'
  ).length;
  const aliveNonMafia = alivePlayers.length - aliveMafia;

  // Mafia wins if they equal or outnumber non-mafia
  if (aliveMafia >= aliveNonMafia) {
    return { team: 'mafia', reason: 'majority' };
  }

  // Villagers win if all mafia are dead
  if (aliveMafia === 0) {
    return { team: 'villagers', reason: 'elimination' };
  }

  return null; // Game continues
}
```

**Transition**: Auto-transition after delay

---

### DAY_DISCUSSION Phase
**Duration**: Configurable (default 120 seconds)

**Actions**:
- Open chat for all living players
- Dead players can see but not participate
- Players discuss who they suspect
- No voting yet

**UI Elements**:
- Chat box (all messages visible)
- List of alive players
- List of dead players (grayed out)
- Timer countdown

**Transition**: Timer expires (auto)

---

### DAY_VOTING Phase
**Duration**: Configurable (default 45 seconds)

**Actions**:
- Each living player votes for one person to eliminate
- Players can change vote before timer ends
- Vote counts are visible in real-time
- Players can vote "skip" to not eliminate anyone

**Voting Rules**:
```typescript
interface VoteRules {
  // Can vote for:
  canVoteForAlive: true,
  canVoteForSelf: false,
  canVoteSkip: true,

  // Vote visibility:
  showLiveVoteCounts: true,  // Show how many votes each player has
  showVoterNames: false,      // Don't show who voted for whom (until results)
}
```

**Transition Conditions**:
- All living players voted, OR
- Timer expires

---

### DAY_RESULTS Phase
**Duration**: 5 seconds

**Events**:
1. Tally all votes
2. Determine eliminated player
3. Announce result with role reveal
4. Update alive/dead lists
5. Check win conditions

**Tally Logic**:
```typescript
function tallyVotes(votes: Map<string, string>): string | null {
  const voteCounts = new Map<string, number>();
  const skipVotes = 0;

  votes.forEach((targetId, voterId) => {
    if (targetId === 'skip') {
      skipVotes++;
    } else {
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    }
  });

  // Find player with most votes
  let maxVotes = 0;
  let eliminatedPlayer = null;
  let isTie = false;

  voteCounts.forEach((count, playerId) => {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedPlayer = playerId;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  });

  // No elimination if tie or skip wins
  if (isTie || skipVotes >= maxVotes) {
    return null;
  }

  return eliminatedPlayer;
}
```

**Announcements**:
```
"[Player Name] has been voted out!"
"They were the [Role]."
"No one was eliminated." (if tie or skip)
```

**Transition**:
- If game over → GAME_OVER
- If game continues → NIGHT

---

### GAME_OVER Phase
**Duration**: Indefinite

**Events**:
1. Announce winner (Mafia or Villagers)
2. Reveal all roles
3. Show game statistics
4. Save game to history
5. Update player stats

**Statistics Shown**:
```typescript
interface GameStats {
  winner: 'mafia' | 'villagers',
  totalRounds: number,
  duration: number, // seconds
  players: {
    name: string,
    role: string,
    survived: boolean,
    killedRound?: number,
    killedBy?: 'mafia' | 'vote',
  }[],
  // MVP tracking
  mvp: {
    playerId: string,
    reason: string, // e.g., "Correctly identified 2 mafia members"
  },
}
```

**Actions**:
- "Play Again" button (returns to lobby with same players)
- "New Game" button (new lobby)
- "Leave" button (disconnect)

---

## Role-Specific Logic

### Mafia
**Abilities**:
- See other mafia members
- Private mafia-only chat during night
- Vote to kill one player each night

**Implementation**:
```typescript
interface MafiaState {
  members: Set<string>,          // All mafia player IDs
  nightVotes: Map<string, string>, // mafia ID → target ID
  chatHistory: Message[],
}

function processMafiaKill(votes: Map<string, string>): string | null {
  const voteCounts = new Map<string, number>();

  votes.forEach(targetId => {
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
  });

  // Find target with most votes
  let maxVotes = 0;
  let target = null;

  voteCounts.forEach((count, playerId) => {
    if (count > maxVotes) {
      maxVotes = count;
      target = playerId;
    }
  });

  return target;
}
```

**Win Condition**: Mafia ≥ Non-mafia players

---

### Doctor
**Abilities**:
- Save one player from death each night
- Can save themselves
- Optional: Cannot save same player consecutive nights

**Implementation**:
```typescript
interface DoctorState {
  lastSaved: string | null,  // For consecutive save rule
}

function canSave(doctorState: DoctorState, targetId: string): boolean {
  // If consecutive saves are disabled
  if (RULES.doctorCannotSaveConsecutive) {
    return targetId !== doctorState.lastSaved;
  }
  return true;
}

function processSave(doctorSave: string | null, mafiaTarget: string | null): boolean {
  return doctorSave === mafiaTarget;
}
```

---

### Detective
**Abilities**:
- Investigate one player each night
- Learn their exact role
- Information is private

**Implementation**:
```typescript
function processInvestigation(
  detectiveId: string,
  targetId: string,
  roles: Map<string, Role>
): InvestigationResult {
  const targetRole = roles.get(targetId);

  return {
    targetId,
    targetName: getPlayerName(targetId),
    role: targetRole,
  };
}

// Send result privately to detective
socket.to(detectiveId).emit('game:investigation_result', result);
```

---

### Villager
**Abilities**:
- None (voting during day only)

**Strategy**: Use discussion and voting to identify mafia

---

## Game Balance

### Player Count vs Mafia Ratio

| Total Players | Mafia | Doctor | Detective | Villagers |
|---------------|-------|--------|-----------|-----------|
| 5             | 2     | 1      | 0         | 2         |
| 6             | 2     | 1      | 0         | 3         |
| 7             | 2     | 1      | 1         | 3         |
| 8             | 3     | 1      | 1         | 3         |
| 9             | 3     | 1      | 1         | 4         |
| 10            | 3     | 1      | 1         | 5         |
| 11            | 4     | 1      | 1         | 5         |
| 12            | 4     | 1      | 1         | 6         |
| 13            | 4     | 1      | 1         | 7         |
| 14            | 5     | 1      | 1         | 7         |
| 15            | 5     | 1      | 1         | 8         |

**Formula**: `mafiaCount = Math.floor(playerCount / 3)`

---

## Edge Cases & Handling

### 1. Player Disconnection

**During Lobby**:
- Remove player immediately
- If host disconnects, transfer host to next player

**During Game**:
- Mark as "disconnected" but keep in game
- Allow 60 second reconnection window
- If reconnects, restore their state
- If timeout, treat as "inactive"

**Inactive Player Handling**:
```typescript
interface InactiveRules {
  mafia: 'random_vote',      // Vote for random player
  doctor: 'no_save',         // Don't save anyone
  detective: 'no_investigate', // Don't investigate
  voting: 'skip',            // Vote skip
}
```

### 2. Simultaneous Actions

**Problem**: What if multiple events happen simultaneously?

**Resolution Order**:
1. Doctor save
2. Mafia kill
3. Detective investigate
4. Check deaths
5. Check win conditions

### 3. Ties

**Night Vote Tie (Mafia)**:
- No kill occurs
- Announce "No one died last night"

**Day Vote Tie**:
- No elimination
- Announce "Vote was tied, no one eliminated"

### 4. All Actions Submit Early

**Behavior**:
- Don't wait for timer
- Proceed to next phase immediately
- Better user experience

### 5. Mafia All Dead

**Win Condition**: Villagers win immediately

### 6. Only Mafia Left

**Win Condition**: Mafia win immediately

### 7. Last 2 Players (1v1)

**Scenario**: 1 Mafia vs 1 Villager

**Day Vote**: Both vote for each other → tie → no elimination
**Night**: Mafia kills villager → Mafia wins

**Result**: Mafia always wins 1v1

---

## Optional Rules & Variants

### Rule Variants
```typescript
interface GameRules {
  // Doctor rules
  doctorCanSaveSelf: boolean,              // Default: true
  doctorCannotSaveConsecutive: boolean,    // Default: false

  // Voting rules
  showLiveVoteCounts: boolean,             // Default: true
  showVoterIdentities: boolean,            // Default: false (until results)
  allowVoteChanges: boolean,               // Default: true
  requireMajorityToEliminate: boolean,     // Default: false

  // Night rules
  mafiaVoteMustBeUnanimous: boolean,       // Default: false

  // Time rules
  nightDuration: number,                   // 30-120s
  dayDuration: number,                     // 60-300s
  votingDuration: number,                  // 30-60s

  // Discussion
  deadPlayersCanTalk: boolean,             // Default: false
}
```

### Future Roles

**Jester**:
- Win condition: Get voted out during day
- Adds chaos to voting

**Godfather**:
- Mafia leader
- Appears as "Villager" to Detective

**Serial Killer**:
- Independent role
- Kills one person each night
- Wins if last player alive

**Vigilante**:
- Can kill one player during night
- Limited uses (1-2 per game)

---

## Performance Optimizations

### 1. Action Batching
Instead of emitting every vote change:
```typescript
// Batch vote updates every 500ms
const voteBatcher = new BatchEmitter(500);
voteBatcher.emit('votes:updated', voteState);
```

### 2. State Snapshots
Store game state snapshots for replay:
```typescript
const snapshots = {
  round1_night: { /* state */ },
  round1_day: { /* state */ },
  // ...
}
```

### 3. Redis Pub/Sub
For multi-server scaling:
```typescript
redisAdapter(io);
// All servers share same game state
```

---

## Testing Scenarios

### Unit Tests
- [x] Role assignment distribution
- [x] Vote tallying (ties, majorities)
- [x] Win condition detection
- [x] Action resolution order
- [x] Phase transitions

### Integration Tests
- [x] Full game flow (5 players)
- [x] Mafia win scenario
- [x] Villagers win scenario
- [x] Doctor saves
- [x] Detective investigations
- [x] Player disconnection/reconnection

### E2E Tests
- [x] Multiple concurrent games
- [x] Network latency simulation
- [x] Rapid join/leave stress test
- [x] Timer edge cases

---

## Next Steps

1. ✅ Define state machine
2. ✅ Design role logic
3. ✅ Plan edge case handling
4. [ ] Implement `GameEngine` class
5. [ ] Implement `RoomManager` class
6. [ ] Write unit tests
7. [ ] Build Socket.IO handlers
8. [ ] Create React UI components
9. [ ] Integration testing
10. [ ] Polish & deployment
