export class Account {
  static load(id: string): Account | null { return null; }
  accountSubsidies: Array<AccountSubsidiesPerCollection> = [];
}

export class CollectionsVault {
  cTokenMarket: string = "";
  static load(id: string): CollectionsVault | null { return null; }
}

export class CollectionParticipation {
  id: string;
  weightFunctionType: string = "";
  weightFunctionP1: any = 0;
  weightFunctionP2: any = 0;
  vault: string = "";
  constructor(id: string) { this.id = id; }
  static load(id: string): CollectionParticipation | null { return null; }
}

export class AccountSubsidiesPerCollection {
  account: string = "";
  collectionParticipation: string = "";
  balanceNFT: any = 0;
  secondsAccumulated: any = 0;
  updatedAtTimestamp: any = 0;
  static load(id: string): AccountSubsidiesPerCollection | null { return null; }
  save(): void {}
}
