export interface PracticeActivity {
  competencyId: string;
  domainId: string;
  title: string;
  category: "CONCEPTUAL" | "PROCEDURAL";
  objective: string;
  instruction: string;
  keyConcepts: string[];
  practice: {
    id: string;
    prompt: string;
    itemType: "MULTIPLE_CHOICE" | "NUMERIC" | "TEXT";
    options?: string[];
    correctAnswer: string;
    explanation: string;
    hints: string[];
  };
}

export const CURATED_ACTIVITIES: Record<string, PracticeActivity> = {
  // --- PYTHON JUNIOR ---
  "py-variables-types": {
    competencyId: "py-variables-types",
    domainId: "python-junior",
    title: "Variables and Primitive Data Types",
    category: "CONCEPTUAL",
    objective: "Master variable assignment, dynamic typing, and primitive types (int, float, str, bool).",
    instruction:
      "In Python, variables are dynamically typed references to objects in memory. Primitive data types include integers (`int`), floating-point numbers (`float`), text sequences (`str`), and truth values (`bool`). Operations between types follow explicit casting rules — Python does not silently coerce strings to numbers.",
    keyConcepts: [
      "Dynamic typing binds names to objects, not fixed memory slots",
      "Float representation adheres to IEEE 754 precision",
      "Strings are immutable sequences of Unicode characters",
      "Boolean values `True` and `False` are subclasses of integers (1 and 0)",
    ],
    practice: {
      id: "prac-py-var-1",
      prompt: "What will be the output of `type(3 + 2.0)` in Python 3?",
      itemType: "MULTIPLE_CHOICE",
      options: ["<class 'int'>", "<class 'float'>", "<class 'number'>", "<class 'double'>"],
      correctAnswer: "<class 'float'>",
      explanation:
        "When an integer and a float are added, Python implicitly promotes the integer to a float, resulting in a float value (5.0).",
      hints: ["Look at the decimal in 2.0.", "Python promotes mixed-arithmetic to floating point."],
    },
  },

  "py-operators-expressions": {
    competencyId: "py-operators-expressions",
    domainId: "python-junior",
    title: "Operators and Expressions",
    category: "PROCEDURAL",
    objective: "Correctly evaluate arithmetic, comparison, and boolean logical operations with operator precedence.",
    instruction:
      "Expressions combine values, variables, and operators to evaluate to a single result. Arithmetic operators include `+`, `-`, `*`, `/`, `//` (floor division), `%` (modulo), and `**` (exponentiation). Logical operators (`and`, `or`, `not`) follow short-circuit evaluation rules.",
    keyConcepts: [
      "Operator precedence: `**` > unary `-` > `*`, `/`, `//`, `%` > `+`, `-`",
      "`//` returns floor integer, while `/` always produces a float",
      "Comparison operators chain: `1 < x < 5` evaluates cleanly in Python",
      "Boolean `and`/`or` operators use short-circuit evaluation",
    ],
    practice: {
      id: "prac-py-op-1",
      prompt: "What is the result of `17 // 3 + 17 % 3`?",
      itemType: "NUMERIC",
      correctAnswer: "7",
      explanation: "17 // 3 is 5 (integer floor division). 17 % 3 is 2 (remainder). 5 + 2 equals 7.",
      hints: ["Calculate 17 // 3 first.", "Then calculate 17 % 3.", "Add the two values."],
    },
  },

  "py-conditionals": {
    competencyId: "py-conditionals",
    domainId: "python-junior",
    title: "Conditional Branching",
    category: "CONCEPTUAL",
    objective: "Implement precise control flow using `if`, `elif`, and `else` branches.",
    instruction:
      "Conditional branching allows programs to make decisions based on runtime conditions. Python uses indentation to define block scope. Clauses evaluate sequentially from top to bottom; the first `if` or `elif` condition that evaluates to truthy executes its block, and remaining branches are skipped entirely.",
    keyConcepts: [
      "Conditions evaluate sequentially; order of `elif` blocks matters",
      "Truthy/falsy evaluation: 0, None, empty collections evaluate to False",
      "The `else` block catches cases where all prior conditions failed",
      "Indentation strictly defines nested branch scope",
    ],
    practice: {
      id: "prac-py-cond-1",
      prompt: "What will this code print?\n```python\nscore = 85\nif score >= 90:\n    print('A')\nelif score >= 80:\n    print('B')\nelif score >= 70:\n    print('C')\nelse:\n    print('D')\n```",
      itemType: "MULTIPLE_CHOICE",
      options: ["A", "B", "C", "D"],
      correctAnswer: "B",
      explanation:
        "The first condition (85 >= 90) is False. The second condition (85 >= 80) is True, so 'B' is printed, and subsequent elif/else branches are bypassed.",
      hints: ["Check the first condition that evaluates to True."],
    },
  },

  "py-loops-iteration": {
    competencyId: "py-loops-iteration",
    domainId: "python-junior",
    title: "Loops and Iteration",
    category: "PROCEDURAL",
    objective: "Construct definite iteration (`for`) and indefinite iteration (`while`) loops.",
    instruction:
      "Python provides `for` loops to iterate over iterable collections or ranges, and `while` loops to repeat execution while a predicate holds true. `break` immediately terminates loop execution, while `continue` skips the remainder of the current iteration and advances to the next step.",
    keyConcepts: [
      "`range(start, stop, step)` generates integers up to but excluding stop",
      "`break` terminates the enclosing loop immediately",
      "`continue` skips immediately to the next iteration",
      "Loops can have an optional `else` block that runs if no `break` occurred",
    ],
    practice: {
      id: "prac-py-loop-1",
      prompt: "What is the final value of `total`?\n```python\ntotal = 0\nfor i in range(1, 5):\n    total += i\n```",
      itemType: "NUMERIC",
      correctAnswer: "10",
      explanation: "range(1, 5) yields 1, 2, 3, 4. The sum is 1 + 2 + 3 + 4 = 10.",
      hints: ["Remember range(1, 5) does NOT include 5.", "Sum 1 + 2 + 3 + 4."],
    },
  },

  "py-functions-scope": {
    competencyId: "py-functions-scope",
    domainId: "python-junior",
    title: "Functions and Variable Scope",
    category: "CONCEPTUAL",
    objective: "Design modular functions with parameters, return statements, and clean local/global variable scoping.",
    instruction:
      "Functions encapsulate reusable logic using `def`. Arguments can be positional or keyword-based. Scope follows the LEGB rule (Local, Enclosing, Global, Built-in). Functions without an explicit `return` evaluate to `None`.",
    keyConcepts: [
      "Functions are first-class objects in Python",
      "Default argument expressions are evaluated once at definition time",
      "Variable lookup order: Local -> Enclosing -> Global -> Built-in (LEGB)",
      "Always return values explicitly for pure, testable functions",
    ],
    practice: {
      id: "prac-py-func-1",
      prompt: "What will `greet('Knowra')` return?\n```python\ndef greet(name, prefix='Hello'):\n    return f'{prefix}, {name}!'\n```",
      itemType: "MULTIPLE_CHOICE",
      options: ["'Hello, Knowra!'", "'prefix, Knowra!'", "None", "Error: missing prefix argument"],
      correctAnswer: "'Hello, Knowra!'",
      explanation: "The default parameter `prefix='Hello'` is used because only the positional argument `'Knowra'` was passed.",
      hints: ["Default parameters are used when arguments are omitted."],
    },
  },

  "py-data-structures-lists-tuples": {
    competencyId: "py-data-structures-lists-tuples",
    domainId: "python-junior",
    title: "Lists and Tuples",
    category: "PROCEDURAL",
    objective: "Manipulate ordered collections with slicing, indexing, comprehensions, and mutability rules.",
    instruction:
      "Lists are mutable sequences defined with square brackets `[]`. Tuples are immutable sequences defined with parentheses `()`. Both support negative indexing and slice notation `[start:stop:step]`.",
    keyConcepts: [
      "Lists are mutable; tuples are immutable",
      "Negative index `-1` accesses the last element",
      "Slice notation: `list[:: -1]` reverses an iterable",
      "List comprehensions provide concise filtering and mapping: `[x*2 for x in nums if x > 0]`",
    ],
    practice: {
      id: "prac-py-ds-1",
      prompt: "What is the value of `x`?\n```python\nnums = [10, 20, 30, 40, 50]\nx = nums[1:4]\n```",
      itemType: "MULTIPLE_CHOICE",
      options: ["[20, 30, 40]", "[10, 20, 30]", "[20, 30, 40, 50]", "[10, 20, 30, 40]"],
      correctAnswer: "[20, 30, 40]",
      explanation: "Slice index 1 is 20, index 2 is 30, index 3 is 40. Index 4 is excluded by the slice boundary.",
      hints: ["The stop index 4 is exclusive."],
    },
  },

  "py-data-structures-dicts-sets": {
    competencyId: "py-data-structures-dicts-sets",
    domainId: "python-junior",
    title: "Dictionaries and Sets",
    category: "CONCEPTUAL",
    objective: "Utilize key-value mappings and unique hash sets for O(1) average-time lookups.",
    instruction:
      "Dictionaries store associative mappings `{key: value}` where keys must be hashable and immutable. Sets are unordered collections of unique elements providing mathematical union, intersection, and difference operations.",
    keyConcepts: [
      "Dictionary keys must be hashable (strings, ints, tuples of immutables)",
      "Dictionary lookup average time complexity is O(1)",
      "Sets automatically deduplicate incoming items",
      "Use `.get(key, default)` for safe lookups without raising KeyError",
    ],
    practice: {
      id: "prac-py-dict-1",
      prompt: "What will `len(set([1, 2, 2, 3, 3, 3]))` evaluate to?",
      itemType: "NUMERIC",
      correctAnswer: "3",
      explanation: "Passing the list to `set()` deduplicates it to `{1, 2, 3}`, which has a length of 3.",
      hints: ["Sets remove all duplicates."],
    },
  },

  "py-error-handling": {
    competencyId: "py-error-handling",
    domainId: "python-junior",
    title: "Error and Exception Handling",
    category: "PROCEDURAL",
    objective: "Gracefully intercept runtime exceptions using `try`, `except`, `else`, and `finally` blocks.",
    instruction:
      "Exceptions disrupt normal execution when unexpected conditions arise. Python uses structured exception handling: code that may fail runs in `try`, handlers catch specific errors in `except`, `else` runs if no error occurred, and `finally` always executes.",
    keyConcepts: [
      "Catch specific exception classes (e.g., `ValueError`, `KeyError`), avoid bare `except:`",
      "The `else` clause runs only when the `try` block completes without errors",
      "The `finally` block runs unconditionally (ideal for resource cleanup)",
      "`raise` triggers an exception manually with descriptive context",
    ],
    practice: {
      id: "prac-py-err-1",
      prompt: "Which block in a try-except structure is GUARANTEED to execute, regardless of whether an exception was raised?",
      itemType: "MULTIPLE_CHOICE",
      options: ["finally", "else", "except", "catch"],
      correctAnswer: "finally",
      explanation: "The `finally` block always executes before leaving the try-except statement, even if unhandled exceptions occurred.",
      hints: ["Think of cleanup blocks that must always run."],
    },
  },

  "py-file-io": {
    competencyId: "py-file-io",
    domainId: "python-junior",
    title: "File Input and Output",
    category: "PROCEDURAL",
    objective: "Safely read and write file resources using context managers (`with open`).",
    instruction:
      "Files are accessed via the built-in `open(path, mode)` function. Modes include `'r'` (read), `'w'` (write/overwrite), and `'a'` (append). The context manager `with open(...) as f:` guarantees deterministic file handle closure even on exceptions.",
    keyConcepts: [
      "Always use `with open(...)` to prevent file descriptor leaks",
      "Mode `'w'` truncates/overwrites existing files; `'a'` appends to end",
      "Read lines via `for line in f:` to stream large files without exhausting RAM",
      "Specify encoding explicitly: `open(file, 'r', encoding='utf-8')`",
    ],
    practice: {
      id: "prac-py-file-1",
      prompt: "What is the primary benefit of using `with open(...) as f:` instead of `f = open(...)`?",
      itemType: "MULTIPLE_CHOICE",
      options: [
        "It automatically closes the file handle even if an error occurs",
        "It makes the file read twice as fast",
        "It automatically parses JSON and CSV formats",
        "It prevents other programs from reading the file",
      ],
      correctAnswer: "It automatically closes the file handle even if an error occurs",
      explanation:
        "The context manager calls `f.__exit__()` upon leaving the block, guaranteeing the file descriptor is closed properly.",
      hints: ["Consider what happens to open files when errors happen."],
    },
  },

  "py-oop-basics": {
    competencyId: "py-oop-basics",
    domainId: "python-junior",
    title: "Object-Oriented Programming Basics",
    category: "CONCEPTUAL",
    objective: "Model domains with classes, constructors (`__init__`), instance attributes, and encapsulation.",
    instruction:
      "Classes serve as blueprints for objects. The `__init__` constructor method initializes instance attributes upon instantiation. The first parameter of instance methods is always `self`, which references the specific instance.",
    keyConcepts: [
      "Classes encapsulate state (attributes) and behavior (methods)",
      "`self` represents the instance whose method is being invoked",
      "`__init__` initializes attributes upon creation (`Class()`)",
      "Methods without `self` can be made `@classmethod` or `@staticmethod`",
    ],
    practice: {
      id: "prac-py-oop-1",
      prompt: "In Python class methods, what does the `self` parameter represent?",
      itemType: "MULTIPLE_CHOICE",
      options: [
        "The current instance of the class",
        "The parent superclass",
        "A global variable reference",
        "A Python built-in module",
      ],
      correctAnswer: "The current instance of the class",
      explanation: "`self` is an explicit reference to the instance of the class being created or called.",
      hints: ["It refers to the object itself."],
    },
  },

  "py-testing-debugging": {
    competencyId: "py-testing-debugging",
    domainId: "python-junior",
    title: "Unit Testing and Debugging",
    category: "PROCEDURAL",
    objective: "Write deterministic assertions and automated unit tests to verify software correctness.",
    instruction:
      "Testing ensures software components behave as intended across edge cases. Unit tests isolate single functions or classes. Assertions check that expected outputs match actual outputs.",
    keyConcepts: [
      "Tests verify behavior and prevent regressions",
      "Assertions state explicit correctness requirements: `assert result == expected`",
      "Unit tests should be isolated, fast, and deterministic",
      "Edge case testing includes empty inputs, boundary values, and invalid types",
    ],
    practice: {
      id: "prac-py-test-1",
      prompt: "What keyword in Python is used to test if a condition is true, raising an `AssertionError` if it is false?",
      itemType: "MULTIPLE_CHOICE",
      options: ["assert", "test", "verify", "check"],
      correctAnswer: "assert",
      explanation: "The `assert` keyword evaluates an expression and raises an `AssertionError` if the result is False.",
      hints: ["Used in pytest and quick inline checks."],
    },
  },

  // --- MATHEMATICS CURATED ---
  "math-algebraic-expressions": {
    competencyId: "math-algebraic-expressions",
    domainId: "math-exams",
    title: "Algebraic Expressions and Operations",
    category: "CONCEPTUAL",
    objective: "Simplify algebraic expressions, combine like terms, and apply distributive expansion.",
    instruction:
      "Algebraic expressions represent quantitative relationships using numbers, variables, and operation symbols. Like terms share identical variable factors and exponents; only like terms can be combined through addition or subtraction. The distributive law states that `a(b + c) = ab + ac`.",
    keyConcepts: [
      "Combine like terms by adding coefficients: `3x + 5x = 8x`",
      "Distributive law: `a(b + c) = ab + ac`",
      "Negative signs distribute across parenthesized terms: `-(x - y) = -x + y`",
      "Expressions cannot be solved for values without an equals sign",
    ],
    practice: {
      id: "prac-math-alg-1",
      prompt: "Simplify the expression: `3(2x - 4) + 5x`",
      itemType: "MULTIPLE_CHOICE",
      options: ["11x - 12", "11x - 4", "6x - 12", "x - 12"],
      correctAnswer: "11x - 12",
      explanation: "Distribute the 3: 3*2x = 6x, 3*(-4) = -12. Then combine like terms: 6x + 5x - 12 = 11x - 12.",
      hints: ["Multiply 3 into (2x - 4) first.", "Combine 6x and 5x."],
    },
  },

  "math-linear-equations": {
    competencyId: "math-linear-equations",
    domainId: "math-exams",
    title: "Linear Equations in One Variable",
    category: "PROCEDURAL",
    objective: "Isolate single unknown variables using inverse algebraic operations.",
    instruction:
      "Linear equations in one variable take the canonical form `ax + b = c`. Solving involves maintaining balance: whatever operation is performed on one side must be performed on the other side to isolate `x`.",
    keyConcepts: [
      "Inverse operations cancel: addition cancels subtraction, multiplication cancels division",
      "Maintain algebraic equality by applying operations symmetrically to both sides",
      "Check solutions by substituting the result back into the original equation",
    ],
    practice: {
      id: "prac-math-lin-1",
      prompt: "Solve for x: `4x - 7 = 21`",
      itemType: "NUMERIC",
      correctAnswer: "7",
      explanation: "Add 7 to both sides: 4x = 28. Divide both sides by 4: x = 7.",
      hints: ["Add 7 to both sides first.", "Divide 28 by 4."],
    },
  },

  // --- EXCEL PRO CURATED ---
  "xl-navigation-basics": {
    competencyId: "xl-navigation-basics",
    domainId: "excel-pro",
    title: "Workbook Navigation and Data Formatting",
    category: "PROCEDURAL",
    objective: "Master cell references (relative `A1`, absolute `$A$1`, mixed) and spreadsheet structure.",
    instruction:
      "Excel organizes data in two-dimensional grids indexed by columns (letters) and rows (numbers). Cell references determine how formulas behave when copied: relative references (`A1`) shift dynamically, while absolute references (`$A$1`) remain locked to the specified cell.",
    keyConcepts: [
      "Relative references (`A1`) adjust proportionally when copied across rows/columns",
      "Absolute references (`$A$1`) anchor both column and row permanently",
      "Mixed references (`$A1` or `A$1`) lock only column or only row",
      "Keyboard shortcut `F4` cycles reference locking types",
    ],
    practice: {
      id: "prac-xl-nav-1",
      prompt: "If formula `=A1 * $B$1` in cell C1 is copied down to cell C2, what does the formula become?",
      itemType: "MULTIPLE_CHOICE",
      options: ["=A2 * $B$1", "=A2 * $B$2", "=A1 * $B$1", "=A1 * $B$2"],
      correctAnswer: "=A2 * $B$1",
      explanation:
        "The relative reference `A1` shifts one row down to `A2`. The absolute reference `$B$1` remains anchored to `$B$1`.",
      hints: ["Relative references move with the formula.", "Dollar signs lock the row/column."],
    },
  },

  "xl-core-math-functions": {
    competencyId: "xl-core-math-functions",
    domainId: "excel-pro",
    title: "Basic Aggregation Functions",
    category: "PROCEDURAL",
    objective: "Perform statistical and numeric aggregations with `SUM`, `AVERAGE`, `COUNT`, `MAX`, and `MIN`.",
    instruction:
      "Core aggregation functions calculate summary statistics over ranges of cells (e.g. `A1:A10`). `SUM` calculates totals, `AVERAGE` returns the arithmetic mean, `COUNT` counts cells with numeric values, and `COUNTA` counts non-empty cells.",
    keyConcepts: [
      "Range notation uses colon: `SUM(A1:A10)` aggregates all cells from A1 through A10",
      "`COUNT` tallies numbers only, while `COUNTA` tallies text and numbers",
      "Empty cells are ignored in `AVERAGE` calculations",
    ],
    practice: {
      id: "prac-xl-sum-1",
      prompt: "Cells A1:A4 contain values 10, 20, 30, and 40. What is `=AVERAGE(A1:A4)`?",
      itemType: "NUMERIC",
      correctAnswer: "25",
      explanation: "The sum is 10 + 20 + 30 + 40 = 100. Divided by 4 cells, the average is 25.",
      hints: ["Sum the four values.", "Divide by 4."],
    },
  },
};

export function getPracticeActivity(competencyId: string): PracticeActivity | undefined {
  return CURATED_ACTIVITIES[competencyId];
}
