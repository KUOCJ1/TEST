import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from '../components/Header';
import ItineraryTab from '../components/ItineraryTab';
import DiningTab from '../components/DiningTab';
import FavoritesTab from '../components/FavoritesTab';
import { itinerary, restaurants } from '../data/tokyo';

// ─── Header ───────────────────────────────────────────────────────────────────

describe('Header', () => {
  it('renders the app title', () => {
    render(<Header searchQuery="" onSearchChange={() => {}} />);
    expect(screen.getByText('東京旅遊攻略')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<Header searchQuery="" onSearchChange={() => {}} />);
    expect(screen.getByPlaceholderText(/搜尋/)).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const handler = vi.fn();
    render(<Header searchQuery="" onSearchChange={handler} />);
    const input = screen.getByPlaceholderText(/搜尋/);
    fireEvent.change(input, { target: { value: '淺草' } });
    expect(handler).toHaveBeenCalledWith('淺草');
  });

  it('shows current search value in input', () => {
    render(<Header searchQuery="上野" onSearchChange={() => {}} />);
    expect(screen.getByDisplayValue('上野')).toBeInTheDocument();
  });
});

// ─── ItineraryTab ─────────────────────────────────────────────────────────────

describe('ItineraryTab', () => {
  const noop = () => {};

  it('renders day selector buttons for all 5 days', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getAllByText(`Day ${i}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows Day 1 spots by default', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    expect(screen.getByText('淺草寺')).toBeInTheDocument();
  });

  it('switches to Day 2 when clicking Day 2 button', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    fireEvent.click(screen.getAllByText('Day 2')[0]);
    expect(screen.getByText('新宿御苑')).toBeInTheDocument();
  });

  it('filters spots by search query', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery="六本木"
      />
    );
    expect(screen.getByText('六本木之丘')).toBeInTheDocument();
    expect(screen.queryByText('淺草寺')).not.toBeInTheDocument();
  });

  it('shows "找不到相關景點" when search has no results', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery="XYZNOTFOUND"
      />
    );
    expect(screen.getByText('找不到相關景點')).toBeInTheDocument();
  });

  it('calls toggleFavorite when heart button is clicked', () => {
    const toggleFavorite = vi.fn();
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={toggleFavorite}
        searchQuery=""
      />
    );
    const heartBtns = screen.getAllByLabelText('加入收藏');
    fireEvent.click(heartBtns[0]);
    expect(toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('shows tip content when 小提示 button is clicked', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    const tipBtns = screen.getAllByText('小提示');
    fireEvent.click(tipBtns[0]);
    // Day 1 spot 1 tip contains "早上 8 點前"
    expect(screen.getByText(/早上 8 點前/)).toBeInTheDocument();
  });

  it('renders Google Maps links for each spot', () => {
    render(
      <ItineraryTab
        itinerary={itinerary}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    const links = screen.getAllByText('Google Maps');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    });
  });
});

// ─── DiningTab ────────────────────────────────────────────────────────────────

describe('DiningTab', () => {
  const noop = () => {};

  it('renders all restaurants by default', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    expect(screen.getByText(/20 間餐廳|間餐廳/)).toBeInTheDocument();
  });

  it('filters by cuisine type', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    // Target the filter button specifically (role="button" within the filter bar)
    const sushiBtn = screen.getAllByRole('button', { name: '壽司' })[0];
    fireEvent.click(sushiBtn);
    const sushiRestaurants = restaurants.filter((r) => r.cuisine === '壽司');
    expect(screen.getByText(`${sushiRestaurants.length} 間餐廳`)).toBeInTheDocument();
  });

  it('filters by price range ¥', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    fireEvent.click(screen.getByText(/¥ 平價/));
    const cheap = restaurants.filter((r) => r.priceRange === '¥');
    expect(screen.getByText(`${cheap.length} 間餐廳`)).toBeInTheDocument();
  });

  it('shows "找不到符合條件的餐廳" when nothing matches', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery="XYZNOTFOUND"
      />
    );
    expect(screen.getByText('找不到符合條件的餐廳')).toBeInTheDocument();
  });

  it('filters by search query', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery="一蘭"
      />
    );
    expect(screen.getByText('一蘭拉麵（澀谷）')).toBeInTheDocument();
  });

  it('shows must-try items for each restaurant', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery="壽司大"
      />
    );
    expect(screen.getByText('大拖羅')).toBeInTheDocument();
  });

  it('all Maps links point to google.com/maps', () => {
    render(
      <DiningTab
        restaurants={restaurants}
        isFavorite={() => false}
        toggleFavorite={noop}
        searchQuery=""
      />
    );
    const links = screen.getAllByText('Maps');
    links.forEach((link) => {
      expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    });
  });
});

// ─── FavoritesTab ─────────────────────────────────────────────────────────────

describe('FavoritesTab', () => {
  it('shows empty state when no favorites', () => {
    render(
      <FavoritesTab
        itinerary={itinerary}
        restaurants={restaurants}
        favorites={[]}
        toggleFavorite={() => {}}
      />
    );
    expect(screen.getByText('還沒有收藏項目')).toBeInTheDocument();
  });

  it('shows saved spot when its id is in favorites', () => {
    render(
      <FavoritesTab
        itinerary={itinerary}
        restaurants={restaurants}
        favorites={['s1']}
        toggleFavorite={() => {}}
      />
    );
    expect(screen.getByText('淺草寺')).toBeInTheDocument();
  });

  it('shows saved restaurant when its id is in favorites', () => {
    render(
      <FavoritesTab
        itinerary={itinerary}
        restaurants={restaurants}
        favorites={['r1']}
        toggleFavorite={() => {}}
      />
    );
    expect(screen.getByText('壽司大（築地）')).toBeInTheDocument();
  });

  it('shows correct total count', () => {
    render(
      <FavoritesTab
        itinerary={itinerary}
        restaurants={restaurants}
        favorites={['s1', 'r1', 'r2']}
        toggleFavorite={() => {}}
      />
    );
    expect(screen.getByText('共收藏 3 個項目')).toBeInTheDocument();
  });

  it('calls toggleFavorite when unfavoriting', () => {
    const toggle = vi.fn();
    render(
      <FavoritesTab
        itinerary={itinerary}
        restaurants={restaurants}
        favorites={['s1']}
        toggleFavorite={toggle}
      />
    );
    fireEvent.click(screen.getByLabelText('取消收藏'));
    expect(toggle).toHaveBeenCalledWith('s1');
  });
});
