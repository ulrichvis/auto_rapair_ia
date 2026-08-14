const FIELD_PREFIX = "review-field-";
const NODE_PREFIX = "review-node-";

function encodePath(path: string) {
  return encodeURIComponent(path);
}

export function reviewFieldId(path: string) {
  return `${FIELD_PREFIX}${encodePath(path)}`;
}

export function reviewNodeId(path: string) {
  return `${NODE_PREFIX}${encodePath(path)}`;
}

export function validationTargetIds(path: string) {
  const paths: string[] = [];
  let current = path;

  while (current) {
    paths.push(current);
    const withoutProperty = current.replace(/\.[^.\[]+$/, "");
    if (withoutProperty !== current) {
      current = withoutProperty;
      continue;
    }

    const withoutIndex = current.replace(/\[\d+\]$/, "");
    if (withoutIndex !== current) {
      current = withoutIndex;
      continue;
    }

    break;
  }

  return paths.flatMap((candidate) => [
    reviewFieldId(candidate),
    reviewNodeId(candidate),
  ]);
}
