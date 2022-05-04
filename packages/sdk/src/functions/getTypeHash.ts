import { hexUtils } from "@0x/utils";

type EIP712_STRUCT_ABI = Array<{ type: string; name: string }>;

/**
 * Compute the type hash of an EIP712 struct given its ABI.
 */
export function getTypeHash(
  primaryStructName: string,
  primaryStructAbi: EIP712_STRUCT_ABI,
  referencedStructs: { [structName: string]: EIP712_STRUCT_ABI } = {}
): string {
  const primaryStructType = encodeType(primaryStructName, primaryStructAbi);
  // Referenced structs are sorted lexicographically
  const referencedStructTypes = Object.entries(referencedStructs)
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
    .map(([name, abi]) => encodeType(name, abi));
  return hexUtils.hash(
    hexUtils.toHex(
      Buffer.from(primaryStructType + referencedStructTypes.join(""))
    )
  );
}

function encodeType(structName: string, abi: EIP712_STRUCT_ABI): string {
  return [
    `${structName}(`,
    abi.map((a) => `${a.type} ${a.name}`).join(","),
    ")",
  ].join("");
}
