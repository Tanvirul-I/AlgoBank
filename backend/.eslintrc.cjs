module.exports = {
	env: {
		es2021: true,
		node: true
	},
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: "./tsconfig.json",
		tsconfigRootDir: __dirname
	},
	ignorePatterns: ["tests/**"],
	plugins: ["@typescript-eslint", "import"],
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:import/recommended",
		"plugin:import/typescript",
		"prettier"
	],
	rules: {
		"import/order": [
			"error",
			{
				"newlines-between": "always",
				alphabetize: { order: "asc", caseInsensitive: true }
			}
		],
		"@typescript-eslint/no-misused-promises": [
			"error",
			{
				checksVoidReturn: false
			}
		]
	}
};
