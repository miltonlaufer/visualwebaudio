/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow commented-out code',
    },
    messages: {
      commentedCode: 'Avoid leaving commented-out code.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode()

    const codeLikePattern =
      /^\s*\/\/\s*(const|let|var|function\b|if\s*\(|else\b|for\s*\(|while\s*\(|return\b|import\b|export\b)/

    return {
      Program() {
        const comments = sourceCode.getAllComments()

        for (const comment of comments) {
          if (comment.type === 'Line' && codeLikePattern.test(`// ${comment.value.trim()}`)) {
            context.report({
              loc: comment.loc,
              messageId: 'commentedCode',
            })
          }
        }
      },
    }
  },
}

export default rule
