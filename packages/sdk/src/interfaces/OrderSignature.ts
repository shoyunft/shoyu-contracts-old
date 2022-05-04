import { SignatureType } from "../enums";

export interface OrderSignature {
  v: number;
  r: string;
  s: string;
  signatureType: SignatureType;
}
