import { reportAdEventWithPenaltyCheck, formatAdPenaltyMessage } from '../adFarmingGuard';
import { reportAdEvent } from '../../api/config';
import { useAppStore } from '../../store/useAppStore';

jest.mock('../../api/config', () => ({ reportAdEvent: jest.fn() }));

jest.mock('../../store/useAppStore', () => {
  let state: any = { adPenaltyUntil: 0, setAdPenaltyUntil: jest.fn() };
  return {
    useAppStore: {
      getState: () => state,
      setState: (next: any) => { state = { ...state, ...next }; },
    },
  };
});

const mockReport = reportAdEvent as jest.Mock;

const baseEvent = {
  placementKey: 'shorts_feed_rewarded_card',
  adType: 'REWARDED',
  eventType: 'DISMISSED',
  screen: 'SHORTS',
  sessionId: 'session-1',
};

describe('adFarmingGuard — penalty propagation', () => {
  beforeEach(() => {
    mockReport.mockReset();
    useAppStore.setState({ setAdPenaltyUntil: jest.fn() });
  });

  it('stores the penalty when the backend returns one', async () => {
    const until = Date.now() + 300_000;
    mockReport.mockResolvedValue({ penaltyUntil: until });
    await reportAdEventWithPenaltyCheck(baseEvent);
    expect(useAppStore.getState().setAdPenaltyUntil).toHaveBeenCalledWith(until);
  });

  it('does not set a penalty when the backend returns none', async () => {
    mockReport.mockResolvedValue({});
    await reportAdEventWithPenaltyCheck(baseEvent);
    expect(useAppStore.getState().setAdPenaltyUntil).not.toHaveBeenCalled();
  });

  it('tolerates a null response without throwing', async () => {
    mockReport.mockResolvedValue(null);
    await expect(reportAdEventWithPenaltyCheck(baseEvent)).resolves.toBeUndefined();
    expect(useAppStore.getState().setAdPenaltyUntil).not.toHaveBeenCalled();
  });

  it('forwards the full event payload to the API unchanged', async () => {
    mockReport.mockResolvedValue({});
    await reportAdEventWithPenaltyCheck(baseEvent);
    expect(mockReport).toHaveBeenCalledWith(baseEvent);
  });
});

describe('formatAdPenaltyMessage', () => {
  it('renders sub-minute penalties in seconds', () => {
    expect(formatAdPenaltyMessage(45)).toBe('Ads will be available again in 45 seconds.');
  });

  it('renders a one-minute penalty without pluralizing', () => {
    expect(formatAdPenaltyMessage(60)).toBe('Ads will be available again in 1 minute.');
  });

  it('rounds partial minutes up so the message never promises too early', () => {
    expect(formatAdPenaltyMessage(61)).toBe('Ads will be available again in 2 minutes.');
    expect(formatAdPenaltyMessage(300)).toBe('Ads will be available again in 5 minutes.');
  });

  it('handles zero remaining seconds', () => {
    expect(formatAdPenaltyMessage(0)).toBe('Ads will be available again in 0 seconds.');
  });
});
