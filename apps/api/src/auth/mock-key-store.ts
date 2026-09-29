import { Injectable } from '@nestjs/common';

@Injectable()
export class MockKeyStore {
  private _privateKey?: string;
  private _publicKey?: string;

  setKeys(privateKey: string, publicKey: string): void {
    this._privateKey = privateKey;
    this._publicKey = publicKey;
  }

  get privateKey(): string | undefined {
    return this._privateKey;
  }

  get publicKey(): string | undefined {
    return this._publicKey;
  }
}
