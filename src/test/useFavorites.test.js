import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useFavorites } from '../hooks/useFavorites';

const KEY = 'test-favorites';

beforeEach(() => {
  localStorage.clear();
});

describe('useFavorites', () => {
  it('starts with empty favorites', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    const [favorites] = result.current;
    expect(favorites).toEqual([]);
  });

  it('adds a favorite on toggle', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    act(() => result.current[1]('s1'));
    expect(result.current[0]).toContain('s1');
  });

  it('removes a favorite when toggled again', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    act(() => result.current[1]('s1'));
    act(() => result.current[1]('s1'));
    expect(result.current[0]).not.toContain('s1');
  });

  it('can hold multiple favorites', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    act(() => result.current[1]('s1'));
    act(() => result.current[1]('r3'));
    expect(result.current[0]).toEqual(['s1', 'r3']);
  });

  it('isFavorite returns true for saved id', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    act(() => result.current[1]('s2'));
    expect(result.current[2]('s2')).toBe(true);
  });

  it('isFavorite returns false for unsaved id', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    expect(result.current[2]('s99')).toBe(false);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useFavorites(KEY));
    act(() => result.current[1]('s5'));
    const stored = JSON.parse(localStorage.getItem(KEY));
    expect(stored).toContain('s5');
  });

  it('loads existing favorites from localStorage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify(['s1', 's2']));
    const { result } = renderHook(() => useFavorites(KEY));
    expect(result.current[0]).toEqual(['s1', 's2']);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(KEY, 'NOT_VALID_JSON{{{');
    const { result } = renderHook(() => useFavorites(KEY));
    expect(result.current[0]).toEqual([]);
  });
});
