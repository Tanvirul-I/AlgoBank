import crypto from "crypto";

interface IsolationTreeNode {
	size: number;
	splitAttr?: number;
	splitValue?: number;
	left?: IsolationTreeNode;
	right?: IsolationTreeNode;
	isLeaf: boolean;
}

const averagePathLength = (n: number): number => {
	if (n <= 1) {
		return 0;
	}
	return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
};

const randomBetween = (min: number, max: number): number => {
	if (min === max) {
		return min;
	}
	const rand = crypto.randomBytes(4).readUInt32BE() / 0xffffffff;
	return min + rand * (max - min);
};

const buildTree = (
	data: number[][],
	currentDepth: number,
	heightLimit: number
): IsolationTreeNode => {
	if (currentDepth >= heightLimit || data.length <= 1) {
		return { size: data.length, isLeaf: true };
	}

	const dimension = data[0]?.length ?? 0;
	if (dimension === 0) {
		return { size: data.length, isLeaf: true };
	}

	const attribute = Math.min(dimension - 1, Math.floor(randomBetween(0, dimension)));
	const values = data.map((row) => row[attribute]);
	const min = Math.min(...values);
	const max = Math.max(...values);

	if (min === max) {
		return { size: data.length, isLeaf: true };
	}

	const splitValue = randomBetween(min, max);
	const left: number[][] = [];
	const right: number[][] = [];

	for (const row of data) {
		if (row[attribute] < splitValue) {
			left.push(row);
		} else {
			right.push(row);
		}
	}

	return {
		size: data.length,
		splitAttr: attribute,
		splitValue,
		left: buildTree(left.length > 0 ? left : data, currentDepth + 1, heightLimit),
		right: buildTree(right.length > 0 ? right : data, currentDepth + 1, heightLimit),
		isLeaf: false
	};
};

const pathLength = (node: IsolationTreeNode, sample: number[]): number => {
	if (
		node.isLeaf ||
		!node.left ||
		!node.right ||
		node.splitAttr === undefined ||
		node.splitValue === undefined
	) {
		return averagePathLength(node.size);
	}

	if (sample[node.splitAttr] < node.splitValue) {
		return 1 + pathLength(node.left, sample);
	}
	return 1 + pathLength(node.right, sample);
};

export class IsolationForest {
	private trees: IsolationTreeNode[] = [];

	private readonly subsampleSize: number;

	private readonly heightLimit: number;

	constructor(private readonly treeCount = 50, subsampleSize = 64) {
		this.subsampleSize = subsampleSize;
		this.heightLimit = Math.ceil(Math.log2(this.subsampleSize));
	}

	fit(data: number[][]): void {
		if (data.length === 0) {
			this.trees = [];
			return;
		}

		const dimension = data[0].length;
		this.trees = Array.from({ length: this.treeCount }).map(() => {
			const sample = this.randomSample(data, this.subsampleSize);
			const sanitized = sample.map((row) =>
				row.map((value) => (Number.isFinite(value) ? value : 0))
			);
			return buildTree(sanitized, 0, this.heightLimit);
		});

		if (dimension === 0) {
			this.trees = [];
		}
	}

	score(sample: number[]): number {
		if (this.trees.length === 0) {
			return 0;
		}

		const path =
			this.trees.reduce((acc, tree) => acc + pathLength(tree, sample), 0) / this.trees.length;
		const c = averagePathLength(this.subsampleSize);
		const normalized = Math.pow(2, -path / (c || 1));
		return Number.isFinite(normalized) ? normalized : 0;
	}

	private randomSample(data: number[][], size: number): number[][] {
		if (data.length <= size) {
			return data;
		}
		const result: number[][] = [];
		const used = new Set<number>();
		while (result.length < size) {
			const index = Math.min(data.length - 1, Math.floor(randomBetween(0, data.length)));
			if (index >= data.length) {
				continue;
			}
			if (used.has(index)) {
				continue;
			}
			used.add(index);
			result.push(data[index]);
		}
		return result;
	}
}
