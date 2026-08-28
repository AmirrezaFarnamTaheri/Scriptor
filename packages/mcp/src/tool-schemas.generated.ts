// GENERATED from contracts/operations.json. Do not edit by hand.
import type { McpJsonSchema } from '@scriptor/core/contracts/mcp'

export const MCP_TOOL_INPUT_SCHEMAS: Record<string, McpJsonSchema> = {
  "mcp.createNote": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "markdown": {
        "type": "string",
        "maxLength": 2097152
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      }
    },
    "required": [
      "path",
      "markdown",
      "summary"
    ],
    "additionalProperties": false
  },
  "mcp.deleteNote": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      }
    },
    "required": [
      "path",
      "summary"
    ],
    "additionalProperties": false
  },
  "mcp.exportGraph": {
    "type": "object",
    "properties": {
      "focusPath": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 3
      }
    },
    "additionalProperties": false
  },
  "mcp.getGraphNeighbors": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 3
      }
    },
    "required": [
      "path"
    ],
    "additionalProperties": false
  },
  "mcp.inspectBacklinks": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      }
    },
    "required": [
      "path"
    ],
    "additionalProperties": false
  },
  "mcp.inspectBrokenLinks": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "mcp.inspectExportProfiles": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "mcp.inspectGraphSummary": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "mcp.inspectOutline": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      }
    },
    "required": [
      "path"
    ],
    "additionalProperties": false
  },
  "mcp.listTags": {
    "type": "object",
    "properties": {
      "prefix": {
        "type": "string",
        "maxLength": 200
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10000
      }
    },
    "additionalProperties": false
  },
  "mcp.listTasks": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "status": {
        "type": "string",
        "enum": [
          "open",
          "done",
          "all"
        ]
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10000
      }
    },
    "additionalProperties": false
  },
  "mcp.moveNote": {
    "type": "object",
    "properties": {
      "from": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "to": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "updateLinks": {
        "type": "boolean"
      }
    },
    "required": [
      "from",
      "to",
      "summary"
    ],
    "additionalProperties": false
  },
  "mcp.proposePatch": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "proposedMarkdown": {
        "type": "string",
        "maxLength": 2097152
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "baseContentHash": {
        "type": "string",
        "maxLength": 256
      }
    },
    "required": [
      "path",
      "proposedMarkdown",
      "summary"
    ],
    "additionalProperties": false
  },
  "mcp.proposeTagPatch": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "add": {
        "type": "array",
        "items": {
          "type": "string",
          "maxLength": 200
        },
        "maxItems": 100
      },
      "remove": {
        "type": "array",
        "items": {
          "type": "string",
          "maxLength": 200
        },
        "maxItems": 100
      },
      "summary": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000
      },
      "baseContentHash": {
        "type": "string",
        "maxLength": 256
      }
    },
    "required": [
      "path",
      "summary"
    ],
    "additionalProperties": false,
    "anyOf": [
      {
        "required": [
          "add"
        ]
      },
      {
        "required": [
          "remove"
        ]
      }
    ]
  },
  "mcp.readNote": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      }
    },
    "required": [
      "path"
    ],
    "additionalProperties": false
  },
  "mcp.renderMarkdown": {
    "type": "object",
    "properties": {
      "markdown": {
        "type": "string",
        "maxLength": 2097152
      },
      "theme": {
        "type": "string",
        "enum": [
          "default",
          "grace"
        ]
      }
    },
    "required": [
      "markdown"
    ],
    "additionalProperties": false
  },
  "mcp.resolveCitation": {
    "type": "object",
    "properties": {
      "key": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      }
    },
    "required": [
      "key"
    ],
    "additionalProperties": false
  },
  "mcp.search": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 500
      }
    },
    "required": [
      "query"
    ],
    "additionalProperties": false
  },
  "mcp.searchByTag": {
    "type": "object",
    "properties": {
      "tag": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10000
      }
    },
    "required": [
      "tag"
    ],
    "additionalProperties": false
  },
  "mcp.semanticSearch": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "minLength": 1,
        "maxLength": 1000
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 500
      }
    },
    "required": [
      "query"
    ],
    "additionalProperties": false
  },
  "mcp.traverseGraph": {
    "type": "object",
    "properties": {
      "focusPath": {
        "type": "string",
        "minLength": 1,
        "maxLength": 4096
      },
      "depth": {
        "type": "integer",
        "minimum": 1,
        "maximum": 5
      }
    },
    "required": [
      "focusPath"
    ],
    "additionalProperties": false
  },
  "mcp.vaultHealth": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
