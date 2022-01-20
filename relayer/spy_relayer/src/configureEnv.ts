import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  nativeToHexString,
} from "@certusone/wormhole-sdk";

export type CommonEnvironment = {
  logLevel: string;
  promPort: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
};

let loggingEnv: CommonEnvironment | undefined = undefined;

export const getCommonEnvironment: () => CommonEnvironment = () => {
  if (loggingEnv) {
    return loggingEnv;
  } else {
    const env = createCommonEnvironment();
    loggingEnv = env;
    return loggingEnv;
  }
};

function createCommonEnvironment(): CommonEnvironment {
  let logLevel;
  let promPort;
  let readinessPort;
  let logDir;
  let redisHost;
  let redisPort;

  if (!process.env.LOG_LEVEL) {
    throw new Error("Missing required environment variable: LOG_LEVEL");
  } else {
    logLevel = process.env.LOG_LEVEL;
  }

  if (!process.env.LOG_DIR) {
    //Not mandatory
  } else {
    logLevel = process.env.LOG_LEVEL;
  }

  if (!process.env.PROM_PORT) {
    throw new Error("Missing required environment variable: PROM_PORT");
  } else {
    promPort = parseInt(process.env.PROM_PORT);
  }

  if (!process.env.READINESS_PORT) {
    //do nothing
  } else {
    readinessPort = parseInt(process.env.READINESS_PORT);
  }

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  return { logLevel, promPort, readinessPort, logDir, redisHost, redisPort };
}

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
  redisHost: string;
  redisPort: number;
  clearRedisOnInit: boolean;
};

export type ChainConfigInfo = {
  chainId: ChainId;
  chainName: string;
  nodeUrl: string;
  tokenBridgeAddress: string;
  walletPrivateKey?: string[];
  solanaPrivateKey?: Uint8Array[];
  bridgeAddress?: string;
  terraName?: string;
  terraChainId?: string;
  terraCoin?: string;
  terraGasPriceUrl?: string;
  wrappedAsset?: string | null;
};

export type ListenerEnvironment = {
  spyServiceHost: string;
  spyServiceFilters: { chainId: ChainId; emitterAddress: string }[];
  restPort: number;
  numSpyWorkers: number;
  supportedTokens: { chainId: ChainId; address: string }[];
};

let listenerEnv: ListenerEnvironment | undefined = undefined;

export const getListenerEnvironment: () => ListenerEnvironment = () => {
  if (listenerEnv) {
    return listenerEnv;
  } else {
    const env = createListenerEnvironment();
    listenerEnv = env;
    return listenerEnv;
  }
};

const createListenerEnvironment: () => ListenerEnvironment = () => {
  let spyServiceHost: string;
  let spyServiceFilters: { chainId: ChainId; emitterAddress: string }[] = [];
  let restPort: number;
  let numSpyWorkers: number;
  let supportedTokens: { chainId: ChainId; address: string }[] = [];

  if (!process.env.SPY_SERVICE_HOST) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    spyServiceHost = process.env.SPY_SERVICE_HOST;
  }

  if (!process.env.SPY_SERVICE_FILTERS) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    const array = JSON.parse(process.env.SPY_SERVICE_FILTERS);
    if (!array.foreach) {
      throw new Error("Spy service filters is not an array.");
    } else {
      array.forEach((filter: any) => {
        if (filter.chainId && filter.emitterAddress) {
          spyServiceFilters.push({
            chainId: filter.chainId as ChainId,
            emitterAddress: nativeToHexString(
              filter.chainId,
              filter.emitterAddress
            ) as string,
          });
        } else {
          throw new Error("Invalid filter record. " + filter.toString());
        }
      });
    }
  }

  if (!process.env.REST_PORT) {
    throw new Error("Missing required environment variable: REST_PORT");
  } else {
    restPort = parseInt(process.env.REST_PORT);
  }

  if (!process.env.SPY_NUM_WORKERS) {
    throw new Error("Missing required environment variable: SPY_NUM_WORKERS");
  } else {
    numSpyWorkers = parseInt(process.env.SPY_NUM_WORKERS);
  }

  if (!process.env.SUPPORTED_TOKENS) {
    throw new Error("Missing required environment variable: SUPPORTED_TOKENS");
  } else {
    const array = JSON.parse(process.env.SUPPORTED_TOKENS);
    if (!array.foreach) {
      throw new Error("SUPPORTED_TOKENS is not an array.");
    } else {
      array.forEach((token: any) => {
        if (token.chainId && token.address) {
          supportedTokens.push({
            chainId: token.chainId,
            address: token.address,
          });
        } else {
          throw new Error("Invalid token record. " + token.toString());
        }
      });
    }
  }

  return {
    spyServiceHost,
    spyServiceFilters,
    restPort,
    numSpyWorkers,
    supportedTokens,
  };
};

let relayerEnv: RelayerEnvironment | undefined = undefined;

export const getRelayerEnvironment: () => RelayerEnvironment = () => {
  if (relayerEnv) {
    return relayerEnv;
  } else {
    const env = createRelayerEnvironment();
    relayerEnv = env;
    return relayerEnv;
  }
};

const createRelayerEnvironment: () => RelayerEnvironment = () => {
  let supportedChains: ChainConfigInfo[] = [];
  let redisHost: string;
  let redisPort: number;
  let clearRedisOnInit: boolean;

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  if (!process.env.CLEAR_REDIS_ON_INIT) {
    throw new Error(
      "Missing required environment variable: CLEAR_REDIS_ON_INIT"
    );
  } else {
    if (process.env.CLEAR_REDIS_ON_INIT.toLowerCase() === "true") {
      clearRedisOnInit = true;
    } else {
      clearRedisOnInit = false;
    }
  }

  supportedChains = loadChainConfig();

  return {
    supportedChains,
    redisHost,
    redisPort,
    clearRedisOnInit,
  };
};

//Polygon is not supported on local Tilt network atm.
export function loadChainConfig(): ChainConfigInfo[] {
  if (!process.env.SUPPORTED_CHAINS) {
    throw new Error("Missing required environment variable: SUPPORTED_CHAINS");
  }

  const unformattedChains = JSON.parse(process.env.SUPPORTED_CHAINS);
  const supportedChains: ChainConfigInfo[] = [];

  if (!unformattedChains.forEach) {
    throw new Error("SUPPORTED_CHAINS arg was not an array.");
  }

  unformattedChains.forEach((element: any) => {
    if (!element.chainId) {
      throw new Error("Invalid chain config: " + element);
    }
    if (element.chainId === CHAIN_ID_SOLANA) {
      supportedChains.push(createSolanaChainConfig(element));
    } else if (element.chainId === CHAIN_ID_TERRA) {
      supportedChains.push(createTerraChainConfig(element));
    } else {
      supportedChains.push(createEvmChainConfig(element));
    }
  });

  return supportedChains;
}

function createSolanaChainConfig(config: any): ChainConfigInfo {
  let chainId: ChainId;
  let chainName: string;
  let nodeUrl: string;
  let tokenBridgeAddress: string;
  let solanaPrivateKey: Uint8Array[] = [];
  let bridgeAddress: string;
  let wrappedAsset: string | null;

  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (
    !(
      config.solanaPrivateKey &&
      config.solanaPrivateKey.length &&
      config.solanaPrivateKey.forEach
    )
  ) {
    throw new Error("Missing required field in chain config: solanaPrivateKey");
  }
  if (!config.bridgeAddress) {
    throw new Error("Missing required field in chain config: bridgeAddress");
  }
  if (!config.wrappedAsset) {
    throw new Error("Missing required field in chain config: wrappedAsset");
  }

  chainId = config.chainId;
  chainName = config.chainName;
  nodeUrl = config.nodeUrl;
  tokenBridgeAddress = config.tokenBridgeAddress;
  bridgeAddress = config.bridgeAddress;
  wrappedAsset = config.wrappedAsset;

  config.solanaPrivateKey.forEach((item: any) => {
    const uint = Uint8Array.from(item);
    solanaPrivateKey.push(uint);
  });

  return {
    chainId,
    chainName,
    nodeUrl,
    tokenBridgeAddress,
    bridgeAddress,
    solanaPrivateKey,
    wrappedAsset,
  };
}

function createTerraChainConfig(config: any): ChainConfigInfo {
  let chainId: ChainId;
  let chainName: string;
  let nodeUrl: string;
  let tokenBridgeAddress: string;
  let walletPrivateKey: string[];
  let terraName: string;
  let terraChainId: string;
  let terraCoin: string;
  let terraGasPriceUrl: string;

  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (
    !config.walletPrivateKey &&
    config.walletPrivateKey.length &&
    config.walletPrivateKey.forEach
  ) {
    throw new Error("Missing required field in chain config: walletPrivateKey");
  }
  if (!config.terraName) {
    throw new Error("Missing required field in chain config: terraName");
  }
  if (!config.terraChainId) {
    throw new Error("Missing required field in chain config: terraChainId");
  }
  if (!config.terraCoin) {
    throw new Error("Missing required field in chain config: terraCoin");
  }
  if (!config.terraGasPriceUrl) {
    throw new Error("Missing required field in chain config: terraGasPriceUrl");
  }

  chainId = config.chainId;
  chainName = config.chainName;
  nodeUrl = config.nodeUrl;
  tokenBridgeAddress = config.tokenBridgeAddress;
  walletPrivateKey = config.walletPrivateKey;
  terraName = config.terraName;
  terraChainId = config.terraChainId;
  terraCoin = config.terraCoin;
  terraGasPriceUrl = config.terraGasPriceUrl;

  return {
    chainId,
    chainName,
    nodeUrl,
    tokenBridgeAddress,
    walletPrivateKey,
    terraName,
    terraChainId,
    terraCoin,
    terraGasPriceUrl,
  };
}

function createEvmChainConfig(config: any): ChainConfigInfo {
  let chainId: ChainId;
  let chainName: string;
  let nodeUrl: string;
  let tokenBridgeAddress: string;
  let walletPrivateKey: string[];
  let wrappedAsset: string;

  if (!config.chainId) {
    throw new Error("Missing required field in chain config: chainId");
  }
  if (!config.chainName) {
    throw new Error("Missing required field in chain config: chainName");
  }
  if (!config.nodeUrl) {
    throw new Error("Missing required field in chain config: nodeUrl");
  }
  if (!config.tokenBridgeAddress) {
    throw new Error(
      "Missing required field in chain config: tokenBridgeAddress"
    );
  }
  if (
    !config.walletPrivateKey &&
    config.walletPrivateKey.length &&
    config.walletPrivateKey.forEach
  ) {
    throw new Error("Missing required field in chain config: walletPrivateKey");
  }

  if (!config.wrappedAsset) {
    throw new Error("Missing required field in chain config: wrappedAsset");
  }
  chainId = config.chainId;
  chainName = config.chainName;
  nodeUrl = config.nodeUrl;
  tokenBridgeAddress = config.tokenBridgeAddress;
  walletPrivateKey = config.walletPrivateKey;
  wrappedAsset = config.wrappedAsset;

  return {
    chainId,
    chainName,
    nodeUrl,
    tokenBridgeAddress,
    walletPrivateKey,
    wrappedAsset,
  };
}
