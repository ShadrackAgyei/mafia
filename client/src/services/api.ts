import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  GetRoomResponse,
  ErrorResponse,
} from '@shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ErrorResponse;
        throw new Error(error.error.message || 'Request failed');
      }

      return data as T;
    } catch (error: any) {
      console.error(`[API] Error: ${error.message}`);
      throw error;
    }
  }

  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return this.request<CreateRoomResponse>('/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async joinRoom(code: string, request: JoinRoomRequest): Promise<JoinRoomResponse> {
    return this.request<JoinRoomResponse>(`/api/rooms/${code}/join`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getRoom(code: string): Promise<GetRoomResponse> {
    return this.request<GetRoomResponse>(`/api/rooms/${code}`);
  }

  async deleteRoom(code: string, hostId: string): Promise<void> {
    return this.request<void>(`/api/rooms/${code}`, {
      method: 'DELETE',
      body: JSON.stringify({ hostId }),
    });
  }
}

export const apiService = new ApiService();
