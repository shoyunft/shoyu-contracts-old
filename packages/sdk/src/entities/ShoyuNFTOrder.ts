import { hexUtils } from "@0x/utils";
import { isAddress } from "@ethersproject/address";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { splitSignature } from "@ethersproject/bytes";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { keccak256 as solidityKeccak256 } from "@ethersproject/solidity";
import { keccak256 } from "@ethersproject/keccak256";
import { arrayify } from "@ethersproject/bytes";
import { HashZero, Zero, AddressZero } from "@ethersproject/constants";
import { verifyTypedData } from "@ethersproject/wallet";
import MerkleTree from "merkletreejs";

import {
  EIP712_DOMAIN_PARAMETERS,
  MAX_TOKENID_MERKLE_ROOT,
  PROTOCOL_FEE,
  PROTOCOL_FEE_RECIPIENT,
  SHOYU_EXCHANGE_ADDRESS,
} from "../constants";
import {
  NFTStandard,
  TradeDirection,
  SignatureType,
  ChainId,
  ShoyuError,
} from "../enums";
import {
  EIP712TypedData,
  Fee,
  OrderSignature,
  ShoyuNFTOrderProps,
} from "../interfaces";
import {
  createExchangeProxyEIP712Domain,
  getExchangeProxyEIP712Hash,
  getTypeHash,
} from "../functions";

export abstract class ShoyuNFTOrder {
  public static readonly STRUCT_NAME = "ShoyuNFTOrder";
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
    { type: "uint128", name: "nftTokenAmount" },
    { type: "uint8", name: "nftStandard" },
    { type: "bytes32", name: "nftTokenIdsMerkleRoot" },
  ];

  public static readonly FEE_ABI = [
    { type: "address", name: "recipient" },
    { type: "uint256", name: "amount" },
  ];

  public static readonly FEE_TYPE_HASH = getTypeHash(
    "Fee",
    ShoyuNFTOrder.FEE_ABI
  );

  public static readonly TYPE_HASH = getTypeHash(
    ShoyuNFTOrder.STRUCT_NAME,
    ShoyuNFTOrder.STRUCT_ABI,
    {
      ["Fee"]: ShoyuNFTOrder.FEE_ABI,
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
  public nftTokenIds: BigNumber[];
  public nftTokenIdsMerkleRoot: string;
  public nftTokenAmount: BigNumber;
  public fees: Fee[];
  public chainId: number;
  public verifyingContract: string;

  public constructor(props: ShoyuNFTOrderProps) {
    this.direction = props.direction;
    this.maker = props.maker;
    this.taker = props.taker;
    this.expiry = props.expiry;
    this.nonce = props.nonce;
    this.erc20Token = props.erc20Token;
    this.erc20TokenAmount = props.erc20TokenAmount;
    this.fees = props.fees;
    this.nftToken = props.nftToken;
    this.nftTokenId = props.nftTokenId || Zero;
    this.nftTokenIds = props.nftTokenIds;
    this.nftTokenAmount = props.nftTokenAmount;
    this.nftStandard = props.nftStandard;
    this.chainId = props.chainId;
    this.verifyingContract = props.verifyingContract;

    if (this.nftTokenIds.length > 0) {
      const leaves = this.nftTokenIds.map((tokenId) =>
        solidityKeccak256(["uint256"], [tokenId])
      );
      const tree = new MerkleTree(leaves, keccak256, { sort: true });
      this.nftTokenIdsMerkleRoot = tree.getHexRoot();

      if (this.nftTokenIdsMerkleRoot === MAX_TOKENID_MERKLE_ROOT) {
        throw new Error(ShoyuError.INVALID_MERKLE_ROOT);
      }
    } else {
      this.nftTokenIdsMerkleRoot = props?.nftTokenIdsMerkleRoot ?? HashZero;
    }
  }

  public validate() {
    if (!(this.chainId in ChainId)) {
      throw new Error(ShoyuError.INVALID_CHAINID);
    }

    if (
      !isAddress(this.verifyingContract) ||
      (this.chainId !== ChainId.HARDHAT &&
        this.verifyingContract !== SHOYU_EXCHANGE_ADDRESS[this.chainId])
    ) {
      throw new Error(ShoyuError.INVALID_VERIFYING_CONTRACT);
    }

    if (this.expiry.lte(BigNumber.from(Math.floor(Date.now() / 1000)))) {
      throw new Error(ShoyuError.ORDER_EXPIRED);
    }

    if (
      (this.nftStandard === NFTStandard.ERC721 && !this.nftTokenAmount.eq(1)) ||
      (this.nftStandard === NFTStandard.ERC721 && this.nftTokenAmount.lt(1))
    ) {
      throw new Error(ShoyuError.INVALID_NFT_TOKEN_AMOUNT);
    }

    if (this.nftTokenIds.length > 0) {
      if (this.direction !== TradeDirection.BuyNFT) {
        throw new Error(ShoyuError.INVALID_TRADE_DIRECTION);
      }
      if (!this.nftTokenId.eq(Zero)) {
        throw new Error(ShoyuError.INVALID_NFT_TOKENID);
      }

      const leaves = this.nftTokenIds.map((tokenId) =>
        solidityKeccak256(["uint256"], [tokenId])
      );
      const tree = new MerkleTree(leaves, keccak256, { sort: true });
      const root = tree.getHexRoot();
      if (
        root === MAX_TOKENID_MERKLE_ROOT ||
        root !== this.nftTokenIdsMerkleRoot
      ) {
        throw new Error(ShoyuError.INVALID_MERKLE_ROOT);
      }
    }

    if (
      !this.fees.some(
        ({ amount, recipient }) =>
          amount.eq(
            PROTOCOL_FEE.multiply(
              this.getTotalERC20Amount(this.nftTokenAmount).toString()
            ).quotient.toString()
          ) && recipient === PROTOCOL_FEE_RECIPIENT[this.chainId]
      )
    ) {
      throw new Error(ShoyuError.INVALID_PROTOCOL_FEE);
    }
    // TODO: royalty check
  }

  public getTotalERC20Amount(nftTokenAmount: BigNumberish): BigNumber {
    let totalAmount: BigNumber;

    if (nftTokenAmount === this.nftTokenAmount) {
      totalAmount = BigNumber.from(this.erc20TokenAmount);
    } else {
      totalAmount = BigNumber.from(this.erc20TokenAmount)
        .mul(nftTokenAmount)
        .div(this.nftTokenAmount);
    }

    this.fees.forEach((fee: Fee) => {
      if (nftTokenAmount === this.nftTokenAmount) {
        totalAmount = totalAmount.add(fee.amount);
      } else {
        totalAmount = totalAmount.add(
          fee.amount.mul(nftTokenAmount).div(this.nftTokenAmount)
        );
      }
    });

    return totalAmount;
  }

  public getMerkleProof(tokenId: BigNumberish) {
    const leaves = this.nftTokenIds.map((tokenId) =>
      solidityKeccak256(["uint256"], [tokenId])
    );
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const leaf = solidityKeccak256(["uint256"], [tokenId]);
    return tree.getHexProof(leaf).map((item) => arrayify(item));
  }

  public getStructHash(): string {
    return hexUtils.hash(
      hexUtils.concat(
        hexUtils.leftPad(ShoyuNFTOrder.TYPE_HASH),
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
        hexUtils.leftPad(this.nftTokenAmount.toString()),
        hexUtils.leftPad(this.nftStandard),
        hexUtils.leftPad(this.nftTokenIdsMerkleRoot.toString())
      )
    );
  }

  public getEIP712TypedData(): EIP712TypedData {
    return {
      types: {
        EIP712Domain: EIP712_DOMAIN_PARAMETERS,
        [ShoyuNFTOrder.STRUCT_NAME]: ShoyuNFTOrder.STRUCT_ABI,
        ["Fee"]: ShoyuNFTOrder.FEE_ABI,
      },
      domain: createExchangeProxyEIP712Domain(
        this.chainId,
        this.verifyingContract
      ) as any,
      primaryType: ShoyuNFTOrder.STRUCT_NAME,
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
        })) as any,
        nftToken: this.nftToken,
        nftTokenId: this.nftTokenId.toString(),
        nftTokenAmount: this.nftTokenAmount.toString(),
        nftStandard: this.nftStandard,
        nftTokenIdsMerkleRoot: this.nftTokenIdsMerkleRoot,
      },
    };
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

  public async sign(signer: TypedDataSigner): Promise<OrderSignature> {
    const { domain, message } = this.getEIP712TypedData();
    const types = {
      [ShoyuNFTOrder.STRUCT_NAME]: ShoyuNFTOrder.STRUCT_ABI,
      ["Fee"]: ShoyuNFTOrder.FEE_ABI,
    };

    const rawSignature = await signer._signTypedData(domain, types, message);

    const { v, r, s } = splitSignature(rawSignature);

    return { v, r, s, signatureType: SignatureType.EIP712 };
  }

  public verifySignature(signature: OrderSignature) {
    const { domain, message } = this.getEIP712TypedData();
    const types = {
      [ShoyuNFTOrder.STRUCT_NAME]: ShoyuNFTOrder.STRUCT_ABI,
      ["Fee"]: ShoyuNFTOrder.FEE_ABI,
    };

    const signer = verifyTypedData(domain, types, message, signature);
    return (
      signer !== AddressZero &&
      signer.toLowerCase() === this.maker.toLowerCase()
    );
  }

  protected _getFeesHash(): string {
    return hexUtils.hash(
      hexUtils.concat(
        ...this.fees.map((fee) =>
          hexUtils.hash(
            hexUtils.concat(
              hexUtils.leftPad(ShoyuNFTOrder.FEE_TYPE_HASH),
              hexUtils.leftPad(fee.recipient),
              hexUtils.leftPad(fee.amount.toString())
            )
          )
        )
      )
    );
  }
}
