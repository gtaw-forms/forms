import { renderHook, act } from '@testing-library/react-hooks';
import useGtaWorldAuth from './useGtaWorldAuth';

// Mock the gtaWorldAuth service
jest.mock('../services/gtaWorldAuth', () => ({
  initiateGtaWorldLogin: jest.fn(),
  handleOAuthCallback: jest.fn(),
  getCurrentUser: jest.fn(),
  getAccessToken: jest.fn(),
  isAuthenticated: jest.fn(),
  logout: jest.fn(),
  validateSession: jest.fn(),
  makeAuthenticatedRequest: jest.fn(),
  tryRestoreSession: jest.fn(),
  refreshFactionData: jest.fn(),
  isFactionMember: jest.fn(),
}));

describe('useGtaWorldAuth', () => {
  it('should only swap to a character within the faction', () => {
    const { result } = renderHook(() => useGtaWorldAuth());

    // Mock user data
    const user = {
      isFactionMember: true,
      allFactionCharacters: [
        { character: { characterId: 1, characterName: 'Faction Character 1' } },
        { character: { characterId: 2, characterName: 'Faction Character 2' } },
      ],
      characters: [
        { id: 1, name: 'Faction Character 1' },
        { id: 2, name: 'Faction Character 2' },
        { id: 3, name: 'Non-Faction Character' },
      ],
    };

    // Set the user
    act(() => {
      result.current.loadFromSavedProfile({
        ...user,
        faction: user.allFactionCharacters[0].character,
        swappableCharacters: user.allFactionCharacters,
      });
    });

    // Attempt to swap to a non-faction character
    act(() => {
      result.current.swapCharacter(3);
    });

    // Expect the active character to not have changed
    expect(result.current.characterName).toBe('Faction Character 1');

    // Attempt to swap to a faction character
    act(() => {
      result.current.swapCharacter(2);
    });

    // Expect the active character to have changed
    expect(result.current.characterName).toBe('Faction Character 2');
  });
});
