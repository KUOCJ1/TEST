import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

beforeEach(() => {
  localStorage.clear();
});

describe('App navigation', () => {
  it('renders the header title', () => {
    render(<App />);
    expect(screen.getByText('東京旅遊攻略')).toBeInTheDocument();
  });

  it('shows itinerary tab by default', () => {
    render(<App />);
    expect(screen.getByText('淺草寺')).toBeInTheDocument();
  });

  it('switches to dining tab', () => {
    render(<App />);
    // Click dining tab in desktop nav (first occurrence)
    fireEvent.click(screen.getAllByText('美食')[0]);
    expect(screen.getByText('壽司大（築地）')).toBeInTheDocument();
  });

  it('switches to travel info tab', () => {
    render(<App />);
    fireEvent.click(screen.getAllByText('旅遊資訊')[0]);
    expect(screen.getByText('交通指南')).toBeInTheDocument();
  });

  it('switches to favorites tab', () => {
    render(<App />);
    fireEvent.click(screen.getAllByText('收藏')[0]);
    expect(screen.getByText('還沒有收藏項目')).toBeInTheDocument();
  });

  it('search filters itinerary spots', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.change(input, { target: { value: '淺草' } });
    expect(screen.getByText('淺草寺')).toBeInTheDocument();
    expect(screen.queryByText('新宿御苑')).not.toBeInTheDocument();
  });

  it('search filters dining across tabs', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.change(input, { target: { value: '一蘭' } });
    // Switch to dining to see results
    fireEvent.click(screen.getAllByText('美食')[0]);
    expect(screen.getByText('一蘭拉麵（澀谷）')).toBeInTheDocument();
  });

  it('favorites badge shows count after favoriting', () => {
    render(<App />);
    // Click heart on first spot on day 1
    const hearts = screen.getAllByLabelText('加入收藏');
    fireEvent.click(hearts[0]);
    // Badge with "1" should appear in nav
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('favorited item appears in favorites tab', () => {
    render(<App />);
    const hearts = screen.getAllByLabelText('加入收藏');
    fireEvent.click(hearts[0]); // favorite 淺草寺
    fireEvent.click(screen.getAllByText('收藏')[0]);
    expect(screen.getByText('淺草寺')).toBeInTheDocument();
  });

  it('unfavoriting from favorites tab removes the item', () => {
    render(<App />);
    // Favorite 淺草寺
    fireEvent.click(screen.getAllByLabelText('加入收藏')[0]);
    // Go to favorites
    fireEvent.click(screen.getAllByText('收藏')[0]);
    // Unfavorite
    fireEvent.click(screen.getByLabelText('取消收藏'));
    expect(screen.getByText('還沒有收藏項目')).toBeInTheDocument();
  });
});
