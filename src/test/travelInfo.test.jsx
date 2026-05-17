import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TravelInfoTab from '../components/TravelInfoTab';
import { travelInfo } from '../data/tokyo';

describe('TravelInfoTab', () => {
  it('renders all section headings', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    expect(screen.getByText('交通指南')).toBeInTheDocument();
    expect(screen.getByText('實用 App')).toBeInTheDocument();
    expect(screen.getByText('文化禮儀小提示')).toBeInTheDocument();
    expect(screen.getByText('預算參考')).toBeInTheDocument();
    expect(screen.getByText('緊急聯絡')).toBeInTheDocument();
  });

  it('renders all transport names', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    travelInfo.transport.forEach((t) => {
      expect(screen.getByText(t.name)).toBeInTheDocument();
    });
  });

  it('transport detail is hidden by default', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    // First transport desc should not be visible until expanded
    expect(screen.queryByText(travelInfo.transport[0].desc)).not.toBeInTheDocument();
  });

  it('expands transport detail on click', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    fireEvent.click(screen.getByText(travelInfo.transport[0].name));
    expect(screen.getByText(travelInfo.transport[0].desc)).toBeInTheDocument();
  });

  it('collapses transport detail on second click', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    const btn = screen.getByText(travelInfo.transport[0].name);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText(travelInfo.transport[0].desc)).not.toBeInTheDocument();
  });

  it('only one transport item expanded at a time', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    fireEvent.click(screen.getByText(travelInfo.transport[0].name));
    fireEvent.click(screen.getByText(travelInfo.transport[1].name));
    expect(screen.queryByText(travelInfo.transport[0].desc)).not.toBeInTheDocument();
    expect(screen.getByText(travelInfo.transport[1].desc)).toBeInTheDocument();
  });

  it('expanded transport shows a Google Maps link', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    fireEvent.click(screen.getByText(travelInfo.transport[0].name));
    const mapLinks = screen.getAllByText('Google Maps 查詢');
    expect(mapLinks[0].closest('a')).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
  });

  it('renders all app names', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    travelInfo.apps.forEach((app) => {
      expect(screen.getByText(app.name)).toBeInTheDocument();
    });
  });

  it('renders all culture tips', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    travelInfo.tips.forEach((tip) => {
      expect(screen.getByText(tip.title)).toBeInTheDocument();
    });
  });

  it('renders emergency numbers as telephone links', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    expect(screen.getByText('110').closest('a')).toHaveAttribute('href', 'tel:110');
    expect(screen.getByText('119').closest('a')).toHaveAttribute('href', 'tel:119');
  });

  it('renders budget rows', () => {
    render(<TravelInfoTab travelInfo={travelInfo} />);
    expect(screen.getByText('住宿')).toBeInTheDocument();
    expect(screen.getByText('每日總計')).toBeInTheDocument();
  });
});
