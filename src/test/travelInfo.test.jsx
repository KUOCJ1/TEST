import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventModal from '../components/events/EventModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onDelete: vi.fn(),
  event: null,
  initialDate: new Date(2026, 5, 9),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EventModal', () => {
  it('renders title input', () => {
    render(<EventModal {...baseProps} />);
    expect(screen.getByPlaceholderText('事件標題')).toBeInTheDocument();
  });

  it('renders all event type buttons', () => {
    render(<EventModal {...baseProps} />);
    expect(screen.getByText('工作')).toBeInTheDocument();
    expect(screen.getByText('會議')).toBeInTheDocument();
    expect(screen.getByText('私人')).toBeInTheDocument();
    expect(screen.getByText('提醒')).toBeInTheDocument();
  });

  it('shows validation error when submitting empty title', () => {
    render(<EventModal {...baseProps} />);
    fireEvent.click(screen.getByText('新增'));
    expect(screen.getByText('請輸入標題')).toBeInTheDocument();
  });

  it('calls onSave with correct data when form is valid', () => {
    render(<EventModal {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('事件標題'), { target: { value: '團隊會議' } });
    fireEvent.click(screen.getByText('新增'));
    expect(baseProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: '團隊會議' })
    );
  });

  it('calls onClose when cancel is clicked', () => {
    render(<EventModal {...baseProps} />);
    fireEvent.click(screen.getByText('取消'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('shows edit mode when event is provided', () => {
    const event = {
      id: 'e1',
      title: '既有事件',
      type: 'work',
      color: 'blue',
      startAt: '2026-06-09T10:00:00.000Z',
      endAt: '2026-06-09T11:00:00.000Z',
      isAllDay: false,
      isPrivate: false,
      tags: [],
      description: '',
      reminder: '',
    };
    render(<EventModal {...baseProps} event={event} />);
    expect(screen.getByText('編輯事件')).toBeInTheDocument();
    expect(screen.getByText('刪除')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<EventModal {...baseProps} isOpen={false} />);
    expect(screen.queryByPlaceholderText('事件標題')).not.toBeInTheDocument();
  });

  it('pre-fills tags when editing', () => {
    const event = {
      id: 'e1',
      title: 'Tagged Event',
      type: 'work',
      color: 'blue',
      startAt: '2026-06-09T10:00:00.000Z',
      endAt: '2026-06-09T11:00:00.000Z',
      isAllDay: false,
      isPrivate: false,
      tags: ['行銷', '重要'],
      description: '',
      reminder: '',
    };
    render(<EventModal {...baseProps} event={event} />);
    expect(screen.getByDisplayValue('行銷, 重要')).toBeInTheDocument();
  });
});
