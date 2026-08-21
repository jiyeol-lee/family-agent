import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TPurchasesResponse } from './purchases.types';

@Injectable()
export class PurchasesService {
  private readonly _http = inject(HttpClient);
  private readonly _apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  public list(scope: 'active' | 'archived'): Observable<TPurchasesResponse> {
    return this._http.get<TPurchasesResponse>(`${this._apiBaseUrl}/api/v1/purchases?scope=${scope}`);
  }
}
