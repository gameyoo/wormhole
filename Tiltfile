# This Tiltfile contains the deployment and build config for the Wormhole devnet.
#
#  We use Buildkit cache mounts and careful layering to avoid unnecessary rebuilds - almost
#  all source code changes result in small, incremental rebuilds. Dockerfiles are written such
#  that, for example, changing the contract source code won't cause Solana itself to be rebuilt.
#
#  Graph of dependencies between Dockerfiles, image refs and k8s StatefulSets:
#
#      Dockerfile                    Image ref                      StatefulSet
#      +------------------------------------------------------------------------------+
#      rust-1.*
#       +                                                           +-----------------+
#       +-> Dockerfile.agent    +->  solana-agent  +--------+-----> | [agent]         |
#       |                                                   |  +--> |    guardian-N   |
#       +-> solana/Dockerfile   +->  solana-contract +---+  |  |    +-- --------------+
#                                                        |  |  |
#                                                        |  |  |
#                                                        |  |  |    +-----------------+
#                                                        +--|-----> |  solana-devnet  |
#      golang:1.*                                           +-----> | [setup]         |
#       +                                                      |    +-----------------+
#       +-> node/Dockerfile     +->  guardiand-image +---------+
#
#
#      node:lts-alpine
#       +                                                           +-----------------+
#       +-> ethereum/Dockerfile +->  eth-node  +------------------> |    eth-devnet   |
#                                                                   +-----------------+
#

load("ext://namespace", "namespace_create", "namespace_inject")

allow_k8s_contexts("ci")

# Runtime configuration

config.define_string("num", False, "Number of guardian nodes to run")

# You do not usually need to set this argument - this argument is for debugging only. If you do use a different
# namespace, note that the "wormhole" namespace is hardcoded in the e2e test and don't forget specifying the argument
# when running "tilt down".
#
config.define_string("namespace", False, "Kubernetes namespace to use")

config.define_bool("ci", False, "We are running in CI")

cfg = config.parse()
num_guardians = int(cfg.get("num", "5"))
namespace = cfg.get("namespace", "wormhole")
ci = cfg.get("ci", False)

# namespace

if not ci:
    namespace_create(namespace)

def k8s_yaml_with_ns(objects):
    return k8s_yaml(namespace_inject(objects, namespace))

# protos

proto_deps = ["./proto", "buf.yaml", "buf.gen.yaml"]

local_resource(
    name = "proto-gen",
    deps = proto_deps,
    cmd = "tilt docker build -- --target go-export -f Dockerfile.proto -o type=local,dest=node .",
    env = {"DOCKER_BUILDKIT": "1"},
    labels = ["protobuf"],
    allow_parallel = True,
)

# node

docker_build(
    ref = "guardiand-image",
    context = "node",
    dockerfile = "node/Dockerfile",
)

def build_node_yaml():
    node_yaml = read_yaml_stream("devnet/node.yaml")

    for obj in node_yaml:
        if obj["kind"] == "StatefulSet" and obj["metadata"]["name"] == "guardian":
            obj["spec"]["replicas"] = num_guardians
            container = obj["spec"]["template"]["spec"]["containers"][0]
            if container["name"] != "guardiand":
                fail("container 0 is not guardiand")
            container["command"] += ["--devNumGuardians", str(num_guardians)]

    return encode_yaml_stream(node_yaml)

k8s_yaml_with_ns(build_node_yaml())

k8s_resource(
    "guardian",
    resource_deps = ["proto-gen", "solana-devnet"],
    port_forwards = [
        port_forward(6060, name = "Debug/Status Server [:6060]"),
    ],
)

# solana agent and cli (runs alongside node)

docker_build(
    ref = "solana-agent",
    context = ".",
    only = ["./proto", "./solana"],
    dockerfile = "Dockerfile.agent",

    # Ignore target folders from local (non-container) development.
    ignore = ["./solana/target", "./solana/agent/target", "./solana/cli/target"],
)

# solana smart contract

docker_build(
    ref = "solana-contract",
    context = "solana",
    dockerfile = "solana/Dockerfile",
)

# solana local devnet

k8s_yaml_with_ns("devnet/solana-devnet.yaml")

k8s_resource("solana-devnet", port_forwards = [
    port_forward(8899, name = "Solana RPC [:8899]"),
    port_forward(8900, name = "Solana WS [:8900]"),
    port_forward(9000, name = "Solana PubSub [:9000]"),
])

# eth devnet

docker_build(
    ref = "eth-node",
    context = "./ethereum",
    dockerfile = "./ethereum/Dockerfile",

    # ignore local node_modules (in case they're present)
    ignore = ["./ethereum/node_modules"],

    # sync external scripts for incremental development
    # (everything else needs to be restarted from scratch for determinism)
    #
    # This relies on --update-mode=exec to work properly with a non-root user.
    # https://github.com/tilt-dev/tilt/issues/3708
    live_update = [
        sync("./ethereum/src", "/home/node/app/src"),
    ],
)

k8s_yaml_with_ns("devnet/eth-devnet.yaml")

k8s_resource("eth-devnet", port_forwards = [
    port_forward(8545, name = "Ganache RPC [:8545]"),
])
