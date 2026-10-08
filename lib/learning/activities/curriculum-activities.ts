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

  "math-linear-systems": {
    competencyId: "math-linear-systems",
    domainId: "math-exams",
    title: "Systems of Linear Equations",
    category: "PROCEDURAL",
    objective: "Solve systems of two linear equations using substitution or elimination methods.",
    instruction:
      "A linear system comprises two or more equations with common variables. The solution is the point (x, y) where the lines intersect. The substitution method solves one equation for one variable and substitutes it into the second. The elimination method adds or subtracts equations to cancel one variable.",
    keyConcepts: [
      "Substitution works best when a variable already has a coefficient of 1 or -1",
      "Elimination aligns like variables vertically and scales equations by common multiples",
      "Consistent systems have exactly one solution; parallel lines have no solution",
    ],
    practice: {
      id: "prac-math-sys-1",
      prompt: "Find x in the system:\nx + y = 10\nx - y = 4",
      itemType: "NUMERIC",
      correctAnswer: "7",
      explanation: "Add the two equations together: (x + y) + (x - y) = 10 + 4 => 2x = 14 => x = 7.",
      hints: ["Add the two equations to eliminate y.", "Divide 14 by 2."],
    },
  },

  "math-quadratic-equations": {
    competencyId: "math-quadratic-equations",
    domainId: "math-exams",
    title: "Quadratic Equations",
    category: "CONCEPTUAL",
    objective: "Find roots of quadratic equations by factoring and the quadratic formula.",
    instruction:
      "Quadratic equations take the standard form ax^2 + bx + c = 0 (with a != 0). Roots represent the x-intercepts of the parabola. The discriminant Delta = b^2 - 4ac reveals the nature of solutions: Delta > 0 yields two real roots, Delta = 0 yields one repeated root, and Delta < 0 yields two complex roots.",
    keyConcepts: [
      "Zero product property: If a * b = 0, then a = 0 or b = 0",
      "Quadratic formula: x = (-b +- sqrt(b^2 - 4ac)) / (2a)",
      "Factoring trinomials finds factors of (a*c) that add up to b",
    ],
    practice: {
      id: "prac-math-quad-1",
      prompt: "What are the solutions to x^2 - 5x + 6 = 0?",
      itemType: "MULTIPLE_CHOICE",
      options: ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = -1 and x = -6"],
      correctAnswer: "x = 2 and x = 3",
      explanation: "Factor into (x - 2)(x - 3) = 0. Setting each factor to zero gives x = 2 and x = 3.",
      hints: ["Find two numbers that multiply to 6 and add to -5."],
    },
  },

  "math-functions-graphs": {
    competencyId: "math-functions-graphs",
    domainId: "math-exams",
    title: "Functions and Graphs",
    category: "CONCEPTUAL",
    objective: "Understand function notation, domain, range, slope-intercept form, and graphing behavior.",
    instruction:
      "A function f(x) assigns exactly one output to each input from its domain. The graph of a linear function y = mx + b has slope m and y-intercept (0, b). The vertical line test verifies whether a curve represents a valid function.",
    keyConcepts: [
      "Each input x must map to exactly one output y",
      "Slope m = (y2 - y1) / (x2 - x1) measures rate of change",
      "Domain is the set of all allowable inputs; Range is all achieved outputs",
    ],
    practice: {
      id: "prac-math-func-1",
      prompt: "What is the slope of the line passing through points (1, 3) and (3, 7)?",
      itemType: "NUMERIC",
      correctAnswer: "2",
      explanation: "m = (7 - 3) / (3 - 1) = 4 / 2 = 2.",
      hints: ["Use the formula m = (y2 - y1) / (x2 - x1)."],
    },
  },

  "math-trigonometry-ratios": {
    competencyId: "math-trigonometry-ratios",
    domainId: "math-exams",
    title: "Trigonometric Ratios and Right Triangles",
    category: "CONCEPTUAL",
    objective: "Apply sine, cosine, and tangent ratios (SOH-CAH-TOA) and the Pythagorean theorem.",
    instruction:
      "In a right triangle with acute angle theta, trigonometric ratios relate angle measures to side lengths: sin(theta) = opposite/hypotenuse, cos(theta) = adjacent/hypotenuse, tan(theta) = opposite/adjacent. The Pythagorean theorem states a^2 + b^2 = c^2.",
    keyConcepts: [
      "SOH: sin = opposite / hypotenuse",
      "CAH: cos = adjacent / hypotenuse",
      "TOA: tan = opposite / adjacent",
      "Hypotenuse is always the longest side, opposite the 90-degree angle",
    ],
    practice: {
      id: "prac-math-trig-1",
      prompt: "In a right triangle, if the opposite side is 3 and the adjacent side is 4, what is tan(theta)?",
      itemType: "MULTIPLE_CHOICE",
      options: ["3/4", "4/3", "3/5", "4/5"],
      correctAnswer: "3/4",
      explanation: "tan(theta) = opposite / adjacent = 3 / 4.",
      hints: ["TOA: Tangent equals opposite over adjacent."],
    },
  },

  "math-coordinate-geometry": {
    competencyId: "math-coordinate-geometry",
    domainId: "math-exams",
    title: "Coordinate Geometry",
    category: "PROCEDURAL",
    objective: "Calculate distances, midpoints, and geometric properties in the Cartesian plane.",
    instruction:
      "Coordinate geometry connects algebra and geometry. The distance between points (x1, y1) and (x2, y2) is d = sqrt((x2 - x1)^2 + (y2 - y1)^2). The midpoint is M = ((x1 + x2)/2, (y1 + y2)/2).",
    keyConcepts: [
      "Distance formula derives directly from the Pythagorean theorem",
      "Midpoint averages the respective coordinates",
      "Perpendicular slopes satisfy m1 * m2 = -1",
    ],
    practice: {
      id: "prac-math-coord-1",
      prompt: "What is the midpoint between (2, 4) and (6, 10)?",
      itemType: "MULTIPLE_CHOICE",
      options: ["(4, 7)", "(4, 6)", "(3, 7)", "(8, 14)"],
      correctAnswer: "(4, 7)",
      explanation: "Midpoint x = (2 + 6)/2 = 4; Midpoint y = (4 + 10)/2 = 7. Result is (4, 7).",
      hints: ["Average the x values (2 and 6).", "Average the y values (4 and 10)."],
    },
  },

  "math-probability-statistics": {
    competencyId: "math-probability-statistics",
    domainId: "math-exams",
    title: "Foundational Probability and Descriptive Statistics",
    category: "CONCEPTUAL",
    objective: "Calculate theoretical probabilities and compute summary statistics (mean, median, mode).",
    instruction:
      "Probability measures the likelihood of an event: P(E) = favorable outcomes / total possible outcomes. In statistics, the mean is the arithmetic average, the median is the middle value in ordered data, and the mode is the most frequently occurring value.",
    keyConcepts: [
      "0 <= P(E) <= 1; P(certain) = 1, P(impossible) = 0",
      "Mean is sensitive to extreme outliers; median is robust",
      "Complement rule: P(not E) = 1 - P(E)",
    ],
    practice: {
      id: "prac-math-stat-1",
      prompt: "What is the median of the dataset: 3, 7, 9, 15, 20?",
      itemType: "NUMERIC",
      correctAnswer: "9",
      explanation: "With 5 ordered numbers, the middle (3rd) value is 9.",
      hints: ["The list is already sorted.", "Find the middle number."],
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

  "xl-logical-formulas": {
    competencyId: "xl-logical-formulas",
    domainId: "excel-pro",
    title: "Logical Formulas (IF, AND, OR)",
    category: "CONCEPTUAL",
    objective: "Construct conditional logic using single and nested IF statements with boolean operators.",
    instruction:
      "The `IF(logical_test, value_if_true, value_if_false)` function branches formula evaluation based on conditions. Combine with `AND(c1, c2)` to require all conditions, or `OR(c1, c2)` to require at least one condition.",
    keyConcepts: [
      "`IF` returns one of two outcomes based on truth value",
      "`AND` requires every condition to be TRUE",
      "`OR` returns TRUE if any single condition is TRUE",
    ],
    practice: {
      id: "prac-xl-logic-1",
      prompt: "What does `=IF(AND(10 > 5, 20 < 15), 'Yes', 'No')` evaluate to?",
      itemType: "MULTIPLE_CHOICE",
      options: ["No", "Yes", "#VALUE!", "TRUE"],
      correctAnswer: "No",
      explanation: "AND(TRUE, FALSE) is FALSE, so the IF function returns 'No'.",
      hints: ["Is 20 < 15 true or false?", "AND requires all arguments to be true."],
    },
  },

  "xl-conditional-math": {
    competencyId: "xl-conditional-math",
    domainId: "excel-pro",
    title: "Conditional Aggregations (SUMIFS, COUNTIFS)",
    category: "PROCEDURAL",
    objective: "Aggregate subsets of data meeting multiple criteria with `SUMIFS`, `COUNTIFS`, and `AVERAGEIFS`.",
    instruction:
      "`SUMIFS(sum_range, criteria_range1, criteria1, ...)` sums values where corresponding cells meet specified conditions. Unlike legacy `SUMIF`, `SUMIFS` places the `sum_range` first, followed by pairs of criteria ranges and conditions.",
    keyConcepts: [
      "`SUMIFS` puts the sum_range as the first argument",
      "Criteria can use comparison operators in strings: `\">=100\"`",
      "`COUNTIFS` counts rows that satisfy all given criteria pairs simultaneously",
    ],
    practice: {
      id: "prac-xl-condmath-1",
      prompt: "In `=SUMIFS(C1:C10, A1:A10, 'North', B1:B10, '>100')`, which range contains the numbers being summed?",
      itemType: "MULTIPLE_CHOICE",
      options: ["C1:C10", "A1:A10", "B1:B10", "Both A1:A10 and B1:B10"],
      correctAnswer: "C1:C10",
      explanation: "In SUMIFS, the first argument (C1:C10) is always the sum_range.",
      hints: ["SUMIFS puts the numbers to sum at the very beginning."],
    },
  },

  "xl-lookup-functions": {
    competencyId: "xl-lookup-functions",
    domainId: "excel-pro",
    title: "Lookup and Reference (XLOOKUP, INDEX/MATCH)",
    category: "PROCEDURAL",
    objective: "Execute exact and approximate lookups using modern `XLOOKUP` and versatile `INDEX/MATCH`.",
    instruction:
      "`XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode])` replaces `VLOOKUP` and `HLOOKUP`. It searches in any direction, defaults to exact match, and doesn't break when columns are inserted.",
    keyConcepts: [
      "`XLOOKUP` defaults to exact match (no more `, FALSE` required)",
      "`XLOOKUP` can look to the left without column reordering",
      "The optional `if_not_found` argument replaces cumbersome `IFERROR` wraps",
    ],
    practice: {
      id: "prac-xl-look-1",
      prompt: "What is the primary advantage of XLOOKUP over traditional VLOOKUP?",
      itemType: "MULTIPLE_CHOICE",
      options: [
        "It can search to the left of the lookup column and defaults to exact match",
        "It only works with numbers",
        "It requires sorted tables",
        "It is only available in Python",
      ],
      correctAnswer: "It can search to the left of the lookup column and defaults to exact match",
      explanation: "XLOOKUP separates lookup_array from return_array, allowing lookups in any direction safely.",
      hints: ["Think about VLOOKUP's column index limitations."],
    },
  },

  "xl-text-data-cleaning": {
    competencyId: "xl-text-data-cleaning",
    domainId: "excel-pro",
    title: "Text Manipulation and Data Cleaning",
    category: "PROCEDURAL",
    objective: "Clean messy data using `TRIM`, `CLEAN`, `CONCAT`, `TEXTJOIN`, `LEFT`, `RIGHT`, and Flash Fill.",
    instruction:
      "Data preparation requires standardizing text. `TRIM` removes leading, trailing, and duplicate spaces. `TEXTJOIN(delimiter, ignore_empty, text1, ...)` merges strings with a consistent separator.",
    keyConcepts: [
      "`TRIM` removes excess spaces but leaves single spaces between words",
      "`TEXTJOIN` can automatically ignore empty cells",
      "`LEFT(text, num)` and `RIGHT(text, num)` extract fixed-length substrings",
    ],
    practice: {
      id: "prac-xl-text-1",
      prompt: "What does `=TRIM('   Data   Science   ')` return?",
      itemType: "MULTIPLE_CHOICE",
      options: ["'Data Science'", "'DataScience'", "'   Data Science'", "'Data   Science'"],
      correctAnswer: "'Data Science'",
      explanation: "TRIM removes outer spaces and reduces internal multiple spaces to a single space.",
      hints: ["Single space between words is preserved."],
    },
  },

  "xl-pivot-tables": {
    competencyId: "xl-pivot-tables",
    domainId: "excel-pro",
    title: "Pivot Tables and Data Summaries",
    category: "PROCEDURAL",
    objective: "Aggregate and summarize multi-dimensional tabular datasets dynamically using Pivot Tables.",
    instruction:
      "Pivot Tables cross-tabulate large datasets without writing formulas. Drag fields into Rows, Columns, Values, and Filters to generate instant summaries, calculate percentages, or group by dates.",
    keyConcepts: [
      "Source data must have single-row headers and no merged cells",
      "Values field defaults to SUM for numbers and COUNT for text",
      "Date grouping aggregates by Years, Quarters, or Months automatically",
    ],
    practice: {
      id: "prac-xl-piv-1",
      prompt: "When non-numeric text data is placed into the Values area of a Pivot Table, what aggregation is used by default?",
      itemType: "MULTIPLE_CHOICE",
      options: ["COUNT", "SUM", "AVERAGE", "CONCAT"],
      correctAnswer: "COUNT",
      explanation: "Excel defaults to COUNT when text values are aggregated in a Pivot Table.",
      hints: ["You cannot sum text."],
    },
  },

  "xl-visualization-validation": {
    competencyId: "xl-visualization-validation",
    domainId: "excel-pro",
    title: "Data Visualization and Validation",
    category: "PROCEDURAL",
    objective: "Configure dropdown list data validation and build effective charts with conditional formatting.",
    instruction:
      "Data Validation restricts what inputs users can enter into cells (e.g. List from range). Conditional Formatting applies visual styling (color scales, data bars) based on cell values to highlight trends.",
    keyConcepts: [
      "Data Validation prevents dirty data entry at the source",
      "Dropdown validation uses the 'List' type referencing a range: `=Countries!$A$1:$A$10`",
      "Conditional formatting rules evaluate in top-down precedence",
    ],
    practice: {
      id: "prac-xl-vis-1",
      prompt: "Which Excel feature is used to restrict a cell to only accept values from a specific dropdown list?",
      itemType: "MULTIPLE_CHOICE",
      options: ["Data Validation", "Conditional Formatting", "XLOOKUP", "Format Cells"],
      correctAnswer: "Data Validation",
      explanation: "Data Validation allows creators to set criteria such as 'List' to create dropdown options.",
      hints: ["Feature found in the Data tab."],
    },
  },
};

export function getPracticeActivity(competencyId: string): PracticeActivity | undefined {
  return CURATED_ACTIVITIES[competencyId];
}
