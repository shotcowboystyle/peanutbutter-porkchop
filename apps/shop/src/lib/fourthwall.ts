// Fourthwall Storefront API, read at build time.
// https://docs.fourthwall.com/storefront/overview — auth is the storefront_token query param.
import { FOURTHWALL_SHOP_DOMAIN, FOURTHWALL_STOREFRONT_TOKEN } from 'astro:env/server';

const BASE = 'https://storefront-api.fourthwall.com/v1';
const CURRENCY = 'USD';

export interface Money {
  value: number;
  currency: string;
}

export interface Image {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface Variant {
  id: string;
  name: string;
  sku: string;
  unitPrice: Money;
  compareAtPrice: Money | null;
  stock: { type: 'LIMITED'; inStock: number } | { type: 'UNLIMITED' };
  images: Image[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  state: 'AVAILABLE' | 'SOLD_OUT';
  images: Image[];
  variants: Variant[];
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface Page<T> {
  results: T[];
  paging: { hasNextPage: boolean };
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('storefront_token', FOURTHWALL_STOREFRONT_TOKEN);
  url.searchParams.set('currency', CURRENCY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fourthwall ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function getAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const data = await get<Page<T>>(path, { page: String(page), size: '100' });
    out.push(...data.results);
    if (!data.paging.hasNextPage) {
      return out;
    }
  }
}

const listCollections = () => getAll<Collection>('/collections');

const listCollectionProducts = (slug: string) => getAll<Product>(`/collections/${slug}/products`);

/** Every product across every collection, de-duplicated by slug. */
export async function listAllProducts(): Promise<Product[]> {
  const bySlug = new Map<string, Product>();
  for (const c of await listCollections()) {
    for (const p of await listCollectionProducts(c.slug)) {
      bySlug.set(p.slug, p);
    }
  }
  return [...bySlug.values()];
}

export function minPrice(p: Product): Money | undefined {
  return p.variants.reduce<Money | undefined>(
    (min, v) => (!min || v.unitPrice.value < min.value ? v.unitPrice : min),
    undefined
  );
}

export function formatMoney(m: Money): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency }).format(
    m.value
  );
}

/** Fourthwall-hosted checkout for one variant; no cart API needed. */
export function checkoutUrl(variantId: string, quantity = 1): string {
  return `https://${FOURTHWALL_SHOP_DOMAIN}/cart/checkout?products=${variantId}:${quantity}&currency=${CURRENCY}`;
}
