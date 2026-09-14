import { getZodConstraint as getConformZodConstraint } from "@conform-to/zod/v4";

type ZodBag = {
  maximum?: number;
  minimum?: number;
};

type ZodDef = {
  readonly element?: ZodNode;
  readonly getter?: () => ZodNode;
  readonly in?: ZodNode;
  readonly innerType?: ZodNode;
  readonly items?: readonly ZodNode[];
  readonly left?: ZodNode;
  readonly options?: readonly ZodNode[];
  readonly out?: ZodNode;
  readonly right?: ZodNode;
  readonly shape?: Record<string, ZodNode>;
};

type ZodNode = {
  readonly _zod: {
    readonly bag: ZodBag;
    readonly def: ZodDef;
  };
  readonly maxLength?: number | null;
  readonly maxValue?: unknown;
  readonly minLength?: number | null;
  readonly minValue?: unknown;
};

function isZodNode(value: unknown): value is ZodNode {
  return typeof value === "object" && value !== null && "_zod" in value;
}

/**
 * Zod 4.6 computes min/max via getters instead of writing `_zod.bag`.
 * Conform still reads the bag for HTML `minlength` / `maxlength` / `min` / `max`.
 */
function hydrateZodConstraintBag(schema: unknown) {
  const seen = new Set<ZodNode>();

  function visit(node: unknown) {
    if (!isZodNode(node) || seen.has(node)) {
      return;
    }

    seen.add(node);

    const { bag, def } = node._zod;
    if (typeof node.minLength === "number") {
      bag.minimum = node.minLength;
    }
    if (typeof node.maxLength === "number") {
      bag.maximum = node.maxLength;
    }
    if (typeof node.minValue === "number") {
      bag.minimum = node.minValue;
    }
    if (typeof node.maxValue === "number") {
      bag.maximum = node.maxValue;
    }

    if (def.shape) {
      for (const child of Object.values(def.shape)) {
        visit(child);
      }
    }
    visit(def.innerType);
    visit(def.in);
    visit(def.out);
    visit(def.element);
    visit(def.left);
    visit(def.right);
    def.items?.forEach(visit);
    def.options?.forEach(visit);
    if (typeof def.getter === "function") {
      visit(def.getter());
    }
  }

  visit(schema);
}

export function getZodConstraint(
  ...args: Parameters<typeof getConformZodConstraint>
): ReturnType<typeof getConformZodConstraint> {
  hydrateZodConstraintBag(args[0]);
  return getConformZodConstraint(...args);
}
