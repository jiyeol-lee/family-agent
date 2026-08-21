import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PurchasesService } from './purchases.service';
import { TPurchase, TPurchaseComment } from './purchases.types';

type TPurchaseStatus = 'archived' | 'purchased' | 'pending';
type TPurchaseFilter = 'all' | TPurchaseStatus;
type TScope = 'active' | 'archived';
type TSortKey = 'item_name' | 'price' | 'priority' | 'status' | 'updated_at';

@Component({
  selector: 'app-purchases-page',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './purchases.page.html',
  host: { class: 'block' },
})
export class PurchasesPage {
  private readonly _service = inject(PurchasesService);
  private _request?: Subscription;
  private _requestGeneration = 0;

  public readonly purchases = signal<TPurchase[]>([]);
  public readonly loading = signal(true);
  public readonly error = signal('');
  public readonly search = signal('');
  public readonly filter = signal<TPurchaseFilter>('all');
  public readonly scope = signal<TScope>('active');
  public readonly sortKey = signal<TSortKey>('updated_at');
  public readonly sortDirection = signal<'asc' | 'desc'>('desc');
  public readonly tabClasses =
    'cursor-pointer rounded-full border border-[#b9beb7] bg-white px-4 py-[0.55rem] text-[#354038] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#b6d9bf]';
  public readonly selectedTabClasses =
    'cursor-pointer rounded-full border border-[#29352c] bg-[#29352c] px-4 py-[0.55rem] text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#b6d9bf]';
  public readonly priorityClasses = {
    low: 'inline-block rounded-full bg-[#e9edf0] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#46515a] capitalize',
    medium:
      'inline-block rounded-full bg-[#fff0c7] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#775711] capitalize',
    high: 'inline-block rounded-full bg-[#f8d7d5] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#8b2823] capitalize',
  } as const;
  public readonly statusClasses: Record<TPurchaseStatus, string> = {
    pending:
      'inline-block rounded-full bg-[#f2e9d3] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#715a25] capitalize',
    purchased:
      'inline-block rounded-full bg-[#dceee0] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#245f31] capitalize',
    archived:
      'inline-block rounded-full bg-[#e4e4e4] px-[0.55rem] py-1 text-[0.76rem] font-bold text-[#4f4f4f] capitalize',
  };
  public readonly commentClasses = {
    user: 'my-2 rounded-[5px] bg-white px-[0.7rem] py-[0.55rem]',
    action: 'my-2 rounded-[5px] bg-[#eef3eb] px-[0.7rem] py-[0.55rem] text-[#344237]',
  } as const;

  public readonly visiblePurchases = computed(() => {
    const term = this.search().trim().toLocaleLowerCase();
    const priorityOrder = { low: 0, medium: 1, high: 2 };
    return this.purchases()
      .filter((purchase) => {
        const text = [purchase.item_name, ...purchase.comments.map((comment) => comment.content)]
          .join(' ')
          .toLocaleLowerCase();
        const state = this.status(purchase);
        return (!term || text.includes(term)) && (this.filter() === 'all' || this.filter() === state);
      })
      .sort((left, right) => {
        const key = this.sortKey();
        let comparison: number;
        if (key === 'priority') comparison = priorityOrder[left.priority] - priorityOrder[right.priority];
        else if (key === 'price') comparison = (left.price ?? -1) - (right.price ?? -1);
        else if (key === 'status') {
          const statusOrder: Record<TPurchaseStatus, number> = { archived: 0, purchased: 1, pending: 2 };
          comparison = statusOrder[this.status(left)] - statusOrder[this.status(right)];
        } else comparison = left[key].localeCompare(right[key]);
        return this.sortDirection() === 'asc' ? comparison : -comparison;
      });
  });

  constructor() {
    this.load();
  }

  public load(): void {
    const generation = ++this._requestGeneration;
    this._request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this._request = this._service.list(this.scope()).subscribe({
      next: ({ purchases }) => {
        if (generation === this._requestGeneration) {
          this.purchases.set(purchases);
          this.loading.set(false);
        }
      },
      error: () => {
        if (generation === this._requestGeneration) {
          this.error.set('Purchases could not be loaded. Please try again.');
          this.loading.set(false);
        }
      },
    });
  }

  public setScope(scope: TScope): void {
    if (scope !== this.scope()) {
      this.scope.set(scope);
      this.filter.set('all');
      this.load();
    }
  }

  public setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  public setFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value as TPurchaseFilter);
  }

  public sortBy(key: TSortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(key === 'item_name' ? 'asc' : 'desc');
    }
  }

  public sortLabel(key: TSortKey): string {
    return this.sortKey() !== key
      ? 'not sorted'
      : `sorted ${this.sortDirection() === 'asc' ? 'ascending' : 'descending'}`;
  }

  public status(purchase: TPurchase): TPurchaseStatus {
    return purchase.archived_at ? 'archived' : purchase.is_purchased_at ? 'purchased' : 'pending';
  }

  public links(content: string): Array<{ text: string; url?: string }> {
    return content
      .split(/(https?:\/\/[^\s]+)/g)
      .filter(Boolean)
      .map((text) => {
        if (!/^https?:\/\//i.test(text)) return { text };
        try {
          const url = new URL(text);
          return ['http:', 'https:'].includes(url.protocol) ? { text, url: url.href } : { text };
        } catch {
          return { text };
        }
      });
  }

  public changes(comment: TPurchaseComment): Array<{ field: string; from: unknown; to: unknown }> {
    const value = comment.details?.['changes'];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).flatMap(([field, change]) => {
      if (!change || typeof change !== 'object' || Array.isArray(change)) return [];
      const typed = change as Record<string, unknown>;
      return [{ field: field.replace('_', ' '), from: typed['from'], to: typed['to'] }];
    });
  }

  public detailDate(comment: TPurchaseComment, field: string): string | null {
    const value = comment.details?.[field];
    return typeof value === 'string' ? value : null;
  }
}
