import { getContractAddressesForChainOrThrow } from "@0x/contract-addresses";
import { SupportedProvider } from "@0x/subproviders";
import { EIP712TypedData } from "@0x/types";
import { hexUtils } from "@0x/utils";
import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero, Zero } from "@ethersproject/constants";

import {
  createExchangeProxyEIP712Domain,
  EIP712_DOMAIN_PARAMETERS,
  getExchangeProxyEIP712Hash,
  getTypeHash,
} from "./eip712_utils";
import {
  eip712SignHashWithKey,
  eip712SignTypedDataWithProviderAsync,
  ethSignHashWithKey,
  ethSignHashWithProviderAsync,
  Signature,
  SignatureType,
} from "./signature_utils";

export enum TradeDirection {
  SellNFT = 0,
  BuyNFT = 1,
}

export enum OrderStatus {
  Invalid = 0,
  Fillable = 1,
  Unfillable = 2,
  Expired = 3,
}

export enum NFTStandard {
  ERC721 = 0,
  ERC1155 = 1,
}

interface Fee {
  recipient: string;
  amount: BigNumber;
  feeData: string;
}

interface Property {
  propertyValidator: string;
  propertyData: string;
}

const NFT_ORDER_DEFAULT_VALUES = {
  direction: TradeDirection.SellNFT,
  maker: AddressZero,
  taker: AddressZero,
  expiry: Zero,
  nonce: Zero,
  erc20Token: AddressZero,
  erc20TokenAmount: Zero,
  fees: [] as Fee[],
  nftStandard: NFTStandard.ERC721,
  nftToken: AddressZero,
  nftTokenId: Zero,
  nftTokenProperties: [] as Property[],
  nftTokenAmount: Zero,
  chainId: 1,
  verifyingContract: getContractAddressesForChainOrThrow(1).exchangeProxy,
};

type NFTOrderFields = typeof NFT_ORDER_DEFAULT_VALUES;

export class NFTOrder {
  public static readonly STRUCT_NAME = "NFTOrder";
  public static readonly STRUCT_ABI = [
    { type: "uint8", name: "direction" },
    { type: "address", name: "maker" },
    { type: "address", name: "taker" },
    { type: "uint256", name: "expiry" },
    { type: "uint256", name: "nonce" },
    { type: "address", name: "erc20Token" },
    { type: "uint256", name: "erc20TokenAmount" },
    { type: "Fee[]", name: "fees" },
    { type: "address", name: "nftToken" },
    { type: "uint256", name: "nftTokenId" },
    { type: "Property[]", name: "nftTokenProperties" },
    { type: "uint128", name: "nftTokenAmount" },
    { type: "uint8", name: "nftStandard" },
  ];

  public static readonly FEE_ABI = [
    { type: "address", name: "recipient" },
    { type: "uint256", name: "amount" },
    { type: "bytes", name: "feeData" },
  ];
  public static readonly PROPERTY_ABI = [
    { type: "address", name: "propertyValidator" },
    { type: "bytes", name: "propertyData" },
  ];

  public static readonly FEE_TYPE_HASH = getTypeHash("Fee", NFTOrder.FEE_ABI);
  public static readonly PROPERTY_TYPE_HASH = getTypeHash(
    "Property",
    NFTOrder.PROPERTY_ABI
  );

  public static readonly TYPE_HASH = getTypeHash(
    NFTOrder.STRUCT_NAME,
    NFTOrder.STRUCT_ABI,
    {
      ["Fee"]: NFTOrder.FEE_ABI,
      ["Property"]: NFTOrder.PROPERTY_ABI,
    }
  );

  public direction: TradeDirection;
  public maker: string;
  public taker: string;
  public expiry: BigNumber;
  public nonce: BigNumber;
  public erc20Token: string;
  public erc20TokenAmount: BigNumber;
  public nftStandard: NFTStandard;
  public nftToken: string;
  public nftTokenId: BigNumber;
  public nftTokenProperties: Property[];
  public nftTokenAmount: BigNumber;
  public fees: Fee[];
  public chainId: number;
  public verifyingContract: string;

  public constructor(fields: Partial<NFTOrderFields> = {}) {
    const _fields = { ...NFT_ORDER_DEFAULT_VALUES, ...fields };
    this.direction = _fields.direction;
    this.maker = _fields.maker;
    this.taker = _fields.taker;
    this.expiry = _fields.expiry;
    this.nonce = _fields.nonce;
    this.erc20Token = _fields.erc20Token;
    this.erc20TokenAmount = _fields.erc20TokenAmount;
    this.fees = _fields.fees;
    this.nftToken = _fields.nftToken;
    this.nftTokenId = _fields.nftTokenId;
    this.nftTokenProperties = _fields.nftTokenProperties;
    this.nftTokenAmount = _fields.nftTokenAmount;
    this.nftStandard = _fields.nftStandard;
    this.chainId = _fields.chainId;
    this.verifyingContract = _fields.verifyingContract;
  }

  public getStructHash(): string {
    return hexUtils.hash(
      hexUtils.concat(
        hexUtils.leftPad(NFTOrder.TYPE_HASH),
        hexUtils.leftPad(this.direction),
        hexUtils.leftPad(this.maker),
        hexUtils.leftPad(this.taker),
        hexUtils.leftPad(this.expiry.toString()),
        hexUtils.leftPad(this.nonce.toString()),
        hexUtils.leftPad(this.erc20Token),
        hexUtils.leftPad(this.erc20TokenAmount.toString()),
        this._getFeesHash(),
        hexUtils.leftPad(this.nftToken),
        hexUtils.leftPad(this.nftTokenId.toString()),
        this._getPropertiesHash(),
        hexUtils.leftPad(this.nftTokenAmount.toString()),
        hexUtils.leftPad(this.nftStandard)
      )
    );
  }

  public getEIP712TypedData(): EIP712TypedData {
    return {
      types: {
        EIP712Domain: EIP712_DOMAIN_PARAMETERS,
        [NFTOrder.STRUCT_NAME]: NFTOrder.STRUCT_ABI,
        ["Fee"]: NFTOrder.FEE_ABI,
        ["Property"]: NFTOrder.PROPERTY_ABI,
      },
      domain: createExchangeProxyEIP712Domain(
        this.chainId,
        this.verifyingContract
      ) as any,
      primaryType: NFTOrder.STRUCT_NAME,
      message: {
        direction: this.direction,
        maker: this.maker,
        taker: this.taker,
        expiry: this.expiry.toString(),
        nonce: this.nonce.toString(),
        erc20Token: this.erc20Token,
        erc20TokenAmount: this.erc20TokenAmount.toString(),
        fees: this.fees.map((fee) => ({
          recipient: fee.recipient,
          amount: fee.amount.toString(),
          feeData: fee.feeData,
        })) as any,
        nftToken: this.nftToken,
        nftTokenId: this.nftTokenId.toString(),
        nftTokenProperties: this.nftTokenProperties as any,
        nftTokenAmount: this.nftTokenAmount.toString(),
        nftStandard: this.nftStandard,
      },
    };
  }

  protected _getProperties(): Property[] {
    return this.nftTokenProperties;
  }

  public willExpire(secondsFromNow = 0): boolean {
    const millisecondsInSecond = 1000;
    const currentUnixTimestampSec = BigNumber.from(
      Date.now() / millisecondsInSecond
    );
    return this.expiry.lt(currentUnixTimestampSec.add(secondsFromNow));
  }

  public getHash(): string {
    return getExchangeProxyEIP712Hash(
      this.getStructHash(),
      this.chainId,
      this.verifyingContract
    );
  }

  public async getSignatureWithProviderAsync(
    provider: SupportedProvider,
    type: SignatureType = SignatureType.EthSign,
    signer: string = this.maker
  ): Promise<Signature> {
    switch (type) {
      case SignatureType.EIP712:
        return eip712SignTypedDataWithProviderAsync(
          this.getEIP712TypedData(),
          signer,
          provider
        );
      case SignatureType.EthSign:
        return ethSignHashWithProviderAsync(this.getHash(), signer, provider);
      default:
        throw new Error(`Cannot sign with signature type: ${type}`);
    }
  }

  public getSignatureWithKey(
    key: string,
    type: SignatureType = SignatureType.EthSign
  ): Signature {
    switch (type) {
      case SignatureType.EIP712:
        return eip712SignHashWithKey(this.getHash(), key);
      case SignatureType.EthSign:
        return ethSignHashWithKey(this.getHash(), key);
      default:
        throw new Error(`Cannot sign with signature type: ${type}`);
    }
  }

  protected _getPropertiesHash(): string {
    return hexUtils.hash(
      hexUtils.concat(
        ...this._getProperties().map((property) =>
          hexUtils.hash(
            hexUtils.concat(
              hexUtils.leftPad(NFTOrder.PROPERTY_TYPE_HASH),
              hexUtils.leftPad(property.propertyValidator),
              hexUtils.hash(property.propertyData)
            )
          )
        )
      )
    );
  }

  protected _getFeesHash(): string {
    return hexUtils.hash(
      hexUtils.concat(
        ...this.fees.map((fee) =>
          hexUtils.hash(
            hexUtils.concat(
              hexUtils.leftPad(NFTOrder.FEE_TYPE_HASH),
              hexUtils.leftPad(fee.recipient),
              hexUtils.leftPad(fee.amount.toString()),
              hexUtils.hash(fee.feeData)
            )
          )
        )
      )
    );
  }
}