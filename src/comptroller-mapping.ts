import { MarketListed } from '../generated/Comptroller/Comptroller';
import { cToken } from '../generated/templates';

export function handleMarketListed(event: MarketListed): void {
    cToken.create(event.params.cToken);
}
