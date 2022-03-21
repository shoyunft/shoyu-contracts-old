import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "@0x/utils"
import { AddressZero, MaxUint256 } from "@ethersproject/constants"

import { SignatureType } from "../contracts/0x/utils/signature_utils";
import { ERC721Order, NFTOrder, TradeDirection } from "../contracts/0x/utils/nft_orders";

describe("Test buy and sell orders", function () {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.dev = this.signers[2]
        this.minter = this.signers[3]

        /* mock contract factories */
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
        this.WETH9Mock = await ethers.getContractFactory("WETH9Mock", this.minter)
        this.ERC721Mock = await ethers.getContractFactory("TestMintableERC721Token")
        
        /* sushi contract factories */
        this.SushiToken = await ethers.getContractFactory("SushiToken")
        this.UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory")
        this.UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair")
        this.UniswapV2Router = await ethers.getContractFactory("UniswapV2Router02")

        /* 0x contract factories */
        this.ZeroExBootstrap = await ethers.getContractFactory("BootstrapFeature")
        this.ZeroExFullMigration = await ethers.getContractFactory("FullMigration")
        this.ZeroExInitialMigration = await ethers.getContractFactory("InitialMigration")
        this.ZeroEx = await ethers.getContractFactory("ZeroEx")
        this.ZeroExERC721Orders = await ethers.getContractFactory("ERC721OrdersFeature")
        this.ZeroExRegistry = await ethers.getContractFactory("SimpleFunctionRegistryFeature")
        this.ZeroExOwnable = await ethers.getContractFactory("OwnableFeature")
        this.ZeroExFeeCollectorController = await ethers.getContractFactory("FeeCollectorController")
        this.ZeroExTransformERC20 = await ethers.getContractFactory("TransformERC20Feature")
        this.ZeroExMetaTransactions = await ethers.getContractFactory("MetaTransactionsFeature")
        this.ZeroExNativeOrders = await ethers.getContractFactory("NativeOrdersFeature")
        this.ZeroExOtcOrders = await ethers.getContractFactory("OtcOrdersFeature")
        this.ZeroExMigrator = await ethers.getContractFactory("LibMigrate")
        this.ZeroExUniswapFeature = await ethers.getContractFactory("UniswapFeature")

        /* shoyu contract factories */
        this.ShoyuERC721Orders = await ethers.getContractFactory("ShoyuERC721OrdersFeature")
        // this.ShoyuERC1155Orders = await ethers.getContractFactory("ShoyuERC1155OrdersFeature")
    })

    beforeEach(async function () {
        /* mock token deployments */
        this.weth = await this.WETH9Mock.deploy()
        await this.weth.deployed()

        this.sushi = await this.ERC20Mock.deploy("SUSHI", "SUSHI", "100000000")
        await this.sushi.deployed()
    
        this.erc20 = await this.ERC20Mock.deploy("TOKEN", "TOKEN", "100000000")
        await this.erc20.deployed()

        this.erc721 = await this.ERC721Mock.deploy()
        await this.erc721.deployed()

        /* sushi deployments */
        this.sushiswapFactory = await this.UniswapV2Factory.deploy(this.minter.address)
        await this.sushiswapFactory.deployed()

        this.sushiswapRouter = await this.UniswapV2Router.deploy(this.sushiswapFactory.address, this.weth.address)
        await this.sushiswapRouter.deployed()

        /* seed sushi pool */
        const pair = await this.sushiswapFactory.createPair(this.weth.address, this.sushi.address)
    
        this.lp = await this.UniswapV2Pair.attach((await pair.wait()).events[0].args.pair)

        await this.weth.connect(this.minter).deposit({ value: "50000" })
        await this.sushi.transfer(this.minter.address, "100000")
        await this.weth.connect(this.minter).approve(this.sushiswapRouter.address, MaxUint256)
        await this.sushi.connect(this.minter).approve(this.sushiswapRouter.address, MaxUint256)

        await this.sushiswapRouter.connect(this.minter).addLiquidity(
            this.weth.address,
            this.sushi.address,
            ethers.BigNumber.from('50000'),
            ethers.BigNumber.from('100000'),
            0,
            0,
            this.minter.address,
            MaxUint256,
        )

        /* 0x deployments */
        const fullMigration = await this.ZeroExFullMigration.deploy(this.minter.address)
        await fullMigration.deployed()

        this.zeroEx = await this.ZeroEx.deploy(await fullMigration.getBootstrapper())

        const registry = await this.ZeroExRegistry.deploy()
        await registry.deployed()

        const ownable = await this.ZeroExOwnable.deploy()
        await ownable.deployed()

        const feeCollectorController = await this.ZeroExFeeCollectorController.deploy(this.weth.address, AddressZero)
        await feeCollectorController.deployed()

        const transformERC20 = await this.ZeroExTransformERC20.deploy()
        await transformERC20.deployed()

        const metaTransactions = await this.ZeroExMetaTransactions.deploy(this.zeroEx.address)
        await metaTransactions.deployed()

        const nativeOrders = await this.ZeroExNativeOrders.deploy(
            this.zeroEx.address,
            this.weth.address,
            AddressZero,
            feeCollectorController.address,
            70e3
        )
        await nativeOrders.deployed()

        const otcOrders = await this.ZeroExOtcOrders.deploy(this.zeroEx.address, this.weth.address)
        await otcOrders.deployed()

        await fullMigration.connect(this.minter).migrateZeroEx(
            this.minter.address,
            this.zeroEx.address,
            {
                registry: registry.address,
                ownable: ownable.address,
                transformERC20: transformERC20.address,
                metaTransactions: metaTransactions.address,
                nativeOrders: nativeOrders.address,
                otcOrders: otcOrders.address,
            },
            {
                transformerDeployer: this.minter.address,
                zeroExAddress: this.zeroEx.address,
                feeCollectorController: feeCollectorController.address
            },
        )

        /* features */
        const migrator = await ethers.getContractAt("IOwnableFeature", this.zeroEx.address, this.minter)

        const erc721Orders = await this.ZeroExERC721Orders.deploy(this.zeroEx.address, this.weth.address)
        await erc721Orders.deployed()

        await migrator.connect(this.minter).migrate(
            erc721Orders.address,
            erc721Orders.interface.encodeFunctionData("migrate"),
            this.minter.address
        )

        const shoyuERC721Orders = await this.ShoyuERC721Orders.deploy(this.zeroEx.address, this.weth.address, this.sushiswapRouter.address)
        await shoyuERC721Orders.deployed()

        await migrator.connect(this.minter).migrate(
            shoyuERC721Orders.address,
            shoyuERC721Orders.interface.encodeFunctionData("migrate"),
            this.minter.address
        )


        this.zeroEx = await ethers.getContractAt("IZeroEx", this.zeroEx.address)
    })

    it("NFT owner can fill offer (sell order)", async function() {
        await this.weth.connect(this.alice).deposit({ value: "50000" })
        await this.erc721.mint(this.bob.address, "420")

        /* alice creates a buy order for bob's nft */
        await this.weth.connect(this.alice).approve(this.zeroEx.address, "50000")
        const buyOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.BuyNFT,
            erc20Token: this.weth.address,
            erc20TokenAmount: new BigNumber(5000),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = buyOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const buyOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills buy order */
        await this.erc721.connect(this.bob).approve(this.zeroEx.address, "420")
        const tx = await this.zeroEx.connect(this.bob).sellERC721(
            {
                ...buyOrder,
                expiry: ethers.BigNumber.from(buyOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(buyOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(buyOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(buyOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            buyOrderSignature,      // LibSignature
            ethers.BigNumber.from(buyOrder.erc721TokenId.toString()), // tokenId
            false,                  // unwrap
            "0x"                    // callbackData
        )

        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)

        expect(aliceWETHBalance.toString()).to.be.eq("45000")
        expect(aliceERC721Balance.toString()).to.eq("1")
        expect(bobWETHBalance.toString()).to.eq("5000")
        expect(bobERC721Balance.toString()).to.eq("0")
    });

    it("NFT owner can fill offer with swap (sell order)", async function() {
        await this.weth.connect(this.alice).deposit({ value: "50000" })
        await this.erc721.mint(this.bob.address, "420")

        /* alice creates a buy order for bob's nft with weth */
        await this.weth.connect(this.alice).approve(this.zeroEx.address, "50000")
        const buyOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.BuyNFT,
            erc20Token: this.weth.address,
            erc20TokenAmount: new BigNumber(5000),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = buyOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const buyOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills buy order with swap to sushi */
        await this.erc721.connect(this.bob).approve(this.zeroEx.address, "420")
        const tx = await this.zeroEx.connect(this.bob).sellAndSwapERC721(
            {
                ...buyOrder,
                expiry: ethers.BigNumber.from(buyOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(buyOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(buyOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(buyOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            buyOrderSignature,      // LibSignature
            ethers.BigNumber.from(buyOrder.erc721TokenId.toString()), // tokenId
            false,                  // unwrap
            "0x",                   // callbackData
            this.sushi.address,     // outputToken
            0                       // minAmountOut
        )

        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)
        const bobSUSHIBalance = await this.sushi.balanceOf(this.bob.address)

        expect(Number(aliceWETHBalance.toString())).to.be.greaterThan(0)
        expect(aliceERC721Balance.toString()).to.be.eq("1")
        expect(Number(bobWETHBalance.toString())).to.be.lessThan(50000)
        expect(Number(bobSUSHIBalance.toString())).to.be.greaterThan(0)
        expect(bobERC721Balance.toString()).to.be.eq("0")
    });

    it("NFT owner can list an item for sale (sell order) & buyer can fill order", async function() {
        await this.erc721.mint(this.alice.address, "420")
        await this.weth.connect(this.bob).deposit({ value: "50000" })

        /* alice creates sell order for nft */
        await this.erc721.connect(this.alice).approve(this.zeroEx.address, "420")
        const sellOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.SellNFT,
            erc20Token: this.weth.address,
            erc20TokenAmount: new BigNumber(5000),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = sellOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills sell order */
        await this.weth.connect(this.bob).approve(this.zeroEx.address, "5000")
        const tx = await this.zeroEx.connect(this.bob).buyERC721(
            {
                ...sellOrder,
                expiry: ethers.BigNumber.from(sellOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(sellOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(sellOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(sellOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            sellOrderSignature,     // LibSignature
            "0x",                   // callbackData
        )

        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)

        expect(aliceWETHBalance.toString()).to.eq(sellOrder.erc20TokenAmount.toString())
        expect(aliceERC721Balance.toString()).to.eq("0")
        expect(Number(bobWETHBalance.toString())).to.lessThan(50000)
        expect(bobERC721Balance.toString()).to.eq("1")
    });

    it("NFT owner can list an item for sale (sell order) & buyer can swap token to fill order", async function() {
        await this.erc721.mint(this.alice.address, "420")
        await this.weth.connect(this.bob).deposit({ value: "50000" })

        /* alice creates sell order for nft */
        await this.erc721.connect(this.alice).approve(this.zeroEx.address, "420")
        const sellOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.SellNFT,
            erc20Token: this.sushi.address,
            erc20TokenAmount: new BigNumber(100),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = sellOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills sell order and swaps WETH to SUSHI to fill order */
        await this.weth.connect(this.bob).approve(this.zeroEx.address, "5000")
        const tx = await this.zeroEx.connect(this.bob).buyAndSwapERC721(
            {
                ...sellOrder,
                expiry: ethers.BigNumber.from(sellOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(sellOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(sellOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(sellOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            sellOrderSignature,     // LibSignature
            "0x",                   // callbackData
            this.weth.address,      // inputToken
            "5000"                  // maxAmountIn
        )

        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)

        expect(aliceWETHBalance.toString()).to.eq("0")
        expect(aliceERC721Balance.toString()).to.eq("0")
        expect(aliceSUSHIBalance.toString()).to.eq(sellOrder.erc20TokenAmount.toString())
        expect(Number(bobWETHBalance.toString())).to.lessThan(50000)
        expect(bobERC721Balance.toString()).to.eq("1")
    });

    it("Buyer can swap and fill sell order by paying ETH", async function() {
        await this.erc721.mint(this.alice.address, "420")

        /* alice creates sell order for nft */
        await this.erc721.connect(this.alice).approve(this.zeroEx.address, "420")
        const sellOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.SellNFT,
            erc20Token: this.sushi.address,
            erc20TokenAmount: new BigNumber(100),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = sellOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills sell order and swaps WETH to SUSHI to fill order */
        const tx = await this.zeroEx.connect(this.bob).buyAndSwapERC721(
            {
                ...sellOrder,
                expiry: ethers.BigNumber.from(sellOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(sellOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(sellOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(sellOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            sellOrderSignature,     // LibSignature
            "0x",                   // callbackData
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // inputToken
            "500",                 // maxAmountIn
            { value: "500" }    
        )

        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)

        expect(aliceWETHBalance.toString()).to.eq("0")
        expect(aliceERC721Balance.toString()).to.eq("0")
        expect(aliceSUSHIBalance.toString()).to.eq(sellOrder.erc20TokenAmount.toString())
        expect(Number(bobWETHBalance.toString())).to.lessThan(50000)
        expect(bobERC721Balance.toString()).to.eq("1")
    });

    it("Buyer can swap and fill sell order, with seller receiving ETH", async function() {
        await this.erc721.mint(this.alice.address, "420")
        await this.sushi.transfer(this.bob.address, "10000")

        const aliceETHBalanceBefore = await this.alice.getBalance();

        /* alice creates sell order for nft */
        this.erc721.connect(this.alice).approve(this.zeroEx.address, "420")
        const sellOrder = new ERC721Order({
            chainId: 31337,
            verifyingContract: this.zeroEx.address,
            direction: TradeDirection.SellNFT,
            erc20Token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            erc20TokenAmount: new BigNumber(100),
            erc721Token: this.erc721.address,
            erc721TokenId: new BigNumber(420),
            maker: this.alice.address,
            taker: AddressZero,
            nonce: new BigNumber(69),
            expiry: new BigNumber(Math.floor(Date.now() / 1000) + 3600)
        })

        const { domain, message } = sellOrder.getEIP712TypedData();
        const types = {
            [ERC721Order.STRUCT_NAME]: ERC721Order.STRUCT_ABI,
            ['Fee']: NFTOrder.FEE_ABI,
            ['Property']: NFTOrder.PROPERTY_ABI
        }

        const rawSignature = await this.alice._signTypedData(domain, types, message)
        const { v, r, s } = ethers.utils.splitSignature(rawSignature);
        const sellOrderSignature = { v, r, s, signatureType: SignatureType.EIP712 }

        /* bob fills sell order and swaps WETH to SUSHI to fill order */
        await this.sushi.connect(this.bob).approve(this.zeroEx.address, "5000")
        const tx = await this.zeroEx.connect(this.bob).buyAndSwapERC721(
            {
                ...sellOrder,
                expiry: ethers.BigNumber.from(sellOrder.expiry.toString()),
                nonce: ethers.BigNumber.from(sellOrder.nonce.toString()),
                erc20TokenAmount: ethers.BigNumber.from(sellOrder.erc20TokenAmount.toString()),
                erc721TokenId: ethers.BigNumber.from(sellOrder.erc721TokenId.toString())
            },                      // LibNFTOrder
            sellOrderSignature,     // LibSignature
            "0x",                   // callbackData
            this.sushi.address,     // inputToken
            "5000"                 // maxAmountIn
        )

        const aliceETHBalanceAfter = await this.alice.getBalance();
        const aliceWETHBalance = await this.weth.balanceOf(this.alice.address)
        const aliceERC721Balance = await this.erc721.balanceOf(this.alice.address)
        const aliceSUSHIBalance = await this.sushi.balanceOf(this.alice.address)
        const bobWETHBalance = await this.weth.balanceOf(this.bob.address)
        const bobERC721Balance = await this.erc721.balanceOf(this.bob.address)

        expect(aliceWETHBalance.toString()).to.eq("0")
        expect(aliceERC721Balance.toString()).to.eq("0")
        expect(aliceSUSHIBalance.toString()).to.eq("0")
        expect(aliceETHBalanceBefore.toString()).to.not.be.eq(sellOrder.erc20TokenAmount.toString())
        expect(Number(bobWETHBalance.toString())).to.lessThan(50000)
        expect(bobERC721Balance.toString()).to.eq("1")

        // todo - chai use ethers big number
    });
});
