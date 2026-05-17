import { describe, it, expect } from 'vitest';
import { itinerary, restaurants, travelInfo } from '../data/tokyo';

describe('itinerary data', () => {
  it('has exactly 5 days', () => {
    expect(itinerary).toHaveLength(5);
  });

  it('days are numbered 1 to 5', () => {
    const days = itinerary.map((d) => d.day);
    expect(days).toEqual([1, 2, 3, 4, 5]);
  });

  it('every day has at least 2 spots', () => {
    itinerary.forEach((d) => {
      expect(d.spots.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('every spot has required fields', () => {
    itinerary.forEach((day) => {
      day.spots.forEach((spot) => {
        expect(spot).toHaveProperty('id');
        expect(spot).toHaveProperty('name');
        expect(spot).toHaveProperty('desc');
        expect(spot).toHaveProperty('address');
        expect(spot).toHaveProperty('lat');
        expect(spot).toHaveProperty('lng');
        expect(spot).toHaveProperty('tag');
        expect(spot).toHaveProperty('duration');
        expect(spot).toHaveProperty('tip');
      });
    });
  });

  it('all spot ids are unique', () => {
    const ids = itinerary.flatMap((d) => d.spots.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('spot coordinates are within Tokyo bounds', () => {
    itinerary.forEach((day) => {
      day.spots.forEach((spot) => {
        expect(spot.lat).toBeGreaterThan(35.5);
        expect(spot.lat).toBeLessThan(35.9);
        expect(spot.lng).toBeGreaterThan(139.5);
        expect(spot.lng).toBeLessThan(140.0);
      });
    });
  });
});

describe('restaurants data', () => {
  it('has at least 20 restaurants', () => {
    expect(restaurants.length).toBeGreaterThanOrEqual(20);
  });

  it('every restaurant has required fields', () => {
    restaurants.forEach((r) => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('cuisine');
      expect(r).toHaveProperty('priceRange');
      expect(r).toHaveProperty('address');
      expect(r).toHaveProperty('lat');
      expect(r).toHaveProperty('lng');
      expect(r).toHaveProperty('desc');
      expect(r).toHaveProperty('mustTry');
    });
  });

  it('all restaurant ids are unique', () => {
    const ids = restaurants.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('price range is one of ¥, ¥¥, ¥¥¥', () => {
    const valid = ['¥', '¥¥', '¥¥¥'];
    restaurants.forEach((r) => {
      expect(valid).toContain(r.priceRange);
    });
  });

  it('mustTry is an array with at least one item', () => {
    restaurants.forEach((r) => {
      expect(Array.isArray(r.mustTry)).toBe(true);
      expect(r.mustTry.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('covers multiple cuisine types', () => {
    const cuisines = new Set(restaurants.map((r) => r.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(4);
  });
});

describe('travelInfo data', () => {
  it('has transport options', () => {
    expect(travelInfo.transport.length).toBeGreaterThanOrEqual(3);
  });

  it('has app recommendations', () => {
    expect(travelInfo.apps.length).toBeGreaterThanOrEqual(4);
  });

  it('has tips', () => {
    expect(travelInfo.tips.length).toBeGreaterThanOrEqual(4);
  });

  it('has emergency contacts', () => {
    expect(travelInfo.emergency.police).toBe('110');
    expect(travelInfo.emergency.ambulance).toBe('119');
    expect(travelInfo.emergency.touristHotline).toBeTruthy();
  });

  it('has budget reference', () => {
    expect(travelInfo.budget).toHaveProperty('accommodation');
    expect(travelInfo.budget).toHaveProperty('meal');
    expect(travelInfo.budget).toHaveProperty('transport');
    expect(travelInfo.budget).toHaveProperty('daily');
  });

  it('all transport items have mapQuery for Google Maps linking', () => {
    travelInfo.transport.forEach((t) => {
      expect(t).toHaveProperty('mapQuery');
      expect(t.mapQuery.length).toBeGreaterThan(0);
    });
  });
});

describe('no duplicate ids across spots and restaurants', () => {
  it('spot and restaurant ids never clash', () => {
    const spotIds = itinerary.flatMap((d) => d.spots.map((s) => s.id));
    const restaurantIds = restaurants.map((r) => r.id);
    const overlap = spotIds.filter((id) => restaurantIds.includes(id));
    expect(overlap).toEqual([]);
  });
});
