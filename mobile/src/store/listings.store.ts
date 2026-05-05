import { create } from 'zustand';
import { Listing, SearchParams, listingsService } from '../services/listings.service';

type ListingsState = {
  feed: Listing[];
  feedTotal: number;
  feedPage: number;
  feedLoading: boolean;
  feedParams: SearchParams;
  setFeedParams: (params: SearchParams) => void;
  loadFeed: (reset?: boolean) => Promise<void>;

  selected: Listing | null;
  detailLoading: boolean;
  loadDetail: (id: string) => Promise<void>;

  myListings: Listing[];
  myListingsTotal: number;
  myListingsPage: number;
  myListingsLoading: boolean;
  loadMyListings: (reset?: boolean) => Promise<void>;
};

export const useListings = create<ListingsState>((set, get) => ({
  feed: [],
  feedTotal: 0,
  feedPage: 1,
  feedLoading: false,
  feedParams: { sort: 'newest', limit: 20 },

  setFeedParams: (params) => set({ feedParams: params }),

  async loadFeed(reset = false) {
    const { feedPage, feedParams, feedLoading } = get();
    if (feedLoading) return;
    const page = reset ? 1 : feedPage;
    set({ feedLoading: true });
    try {
      const result = await listingsService.search({ ...feedParams, page });
      set((s) => ({
        feed: reset ? result.data : [...s.feed, ...result.data],
        feedTotal: result.total,
        feedPage: page + 1,
        feedLoading: false,
      }));
    } catch {
      set({ feedLoading: false });
    }
  },

  selected: null,
  detailLoading: false,

  async loadDetail(id: string) {
    set({ detailLoading: true, selected: null });
    try {
      const listing = await listingsService.getById(id);
      set({ selected: listing, detailLoading: false });
    } catch {
      set({ detailLoading: false });
    }
  },

  myListings: [],
  myListingsTotal: 0,
  myListingsPage: 1,
  myListingsLoading: false,

  async loadMyListings(reset = false) {
    const { myListingsPage, myListingsLoading } = get();
    if (myListingsLoading) return;
    const page = reset ? 1 : myListingsPage;
    set({ myListingsLoading: true });
    try {
      const result = await listingsService.myListings(page);
      set((s) => ({
        myListings: reset ? result.data : [...s.myListings, ...result.data],
        myListingsTotal: result.total,
        myListingsPage: page + 1,
        myListingsLoading: false,
      }));
    } catch {
      set({ myListingsLoading: false });
    }
  },
}));
