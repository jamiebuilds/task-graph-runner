# task-graph-runner

> Run async tasks with dependencies

## Install

```sh
yarn add task-graph-runner
```

## Usage

```js
import taskGraphRunner from 'task-graph-runner';

let graph = new Map([
  ["task-a", ["task-d"]], // task-a depends on task-d
  ["task-b", ["task-d", "task-a"]],
  ["task-c", ["task-d"]],
  ["task-d", []],
]);

async function task(name) {
  console.log(`start ${name}`);
  let result = await exec(name);
  console.log(`end ${name}`);
  return result;
}

let results = taskGraphRunner({ graph, task });
// { safe: false,
//   values: Map { "task-a" => "result-a", "task-b" => "result-b", ... } }
```

Tasks will wait for their dependencies to run, but will be run with maximum
concurrency:

```
start task-d
end task-d
start task-a
start task-c
end task-a
start task-b
end task-c
end task-b
```

#### Resolving cycles

If there are any cycles of dependencies (task-a depends on task-b which depends
on task-a), then `taskGraphRunner` will error unless `force: true` is passed:

```js
let results = taskGraphRunner({ graph, task, force: true });
```

Graph cycles are resolved by picking a single item from the graph which has yet
to be run that has:

1. The fewest number of remaining dependencies (to reduce risk of missing dependencies)
2. The highest number of remaining dependents (to increase chance of unblocking dependents)

## API

```js
declare function taskGraphRunner<Item, Result>({
  graph: Map<Item, Array<Item>>,
  task: (item: Item) => Result,
  force?: boolean,
}): { safe: boolean, values: Map<Item, Result> };
```

#### `opts.graph`

This is a map of items to their dependencies. Items can be any type as long as
they are `===` to one another.

```js
opts.graph = new Map([
  [1, [2, 3]],
  [2, [4]],
  [3, [4]],
  [4, []],
])
```

#### `opts.task`

This function gets called on every item in the graph. It should return a
promise.

```js
opts.task = async function task(item) {
  // ...
};
```

### `opts.force` (default `false`)

`taskGraphRunner` will error if it detects a cycle unless `opts.force` is
`true` in which case it will try to break cycles by choosing a remaining item
in the graph.

If it does detect a cycle, it will cause `res.safe` to be `false`.

### `res.values`

This is a map of the items in the graph to their results from `opts.task`.

```js
res.values
// Map { "task-a" => "result-a", "task-b" => "result-b", ... }
```

### `res.safe`

If the graph ran without any cycles `res.safe` will be `true`, otherwise it
will be `false`.
