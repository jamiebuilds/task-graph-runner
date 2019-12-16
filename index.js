// @flow
'use strict';
const arrayIncludes = require('array-includes');

/*::
type Opts<Item, Result> = {
  graph: Map<Item, Array<Item>>,
  task: (item: Item) => Promise<Result>,
  force?: boolean,
};

type Results<Item, Result> = {
  safe: boolean,
  values: Map<Item, Result>,
};
*/

function taskGraphRunner/*::<Item, Result>*/(opts /*: Opts<Item, Result> */) /*: Promise<Results<Item, Result>> */ {
  let graph = opts.graph;
  let task = opts.task;
  let force = opts.force || false;

  let safe = true;
  let queue = new Set(graph.keys());
  let running = new Set();

  function getNextChunk() {
    let chunk = [];
    let current = new Map();

    if (!queue.size) {
      return chunk;
    }

    for (let key of queue) {
      let deps = graph.get(key) || [];
      let curr = deps.filter(dep => queue.has(dep));

      current.set(key, curr);

      if (!curr.length) {
        chunk.push(key);
      }
    }

    if (chunk.length === 0) {
      if (!force) {
        throw new Error('Cycle detected in graph');
      }

      let items = Array.from(queue);
      let sorted = items.sort((a, b) => {
        let aCurr = current.get(a) || [];
        let bCurr = current.get(b) || [];
        let deps = aCurr.length - bCurr.length;
        if (deps !== 0) return deps;

        let aChildren = items.filter(item => arrayIncludes(current.get(item) || [], a));
        let bChildren = items.filter(item => arrayIncludes(current.get(item) || [], b));
        return bChildren.length - aChildren.length;
      });

      let first = sorted[0];

      chunk.push(first);
      safe = false;
    }

    chunk = chunk.filter(key => {
      let deps = graph.get(key) || [];
      return !deps.find(dep => running.has(dep));
    });

    for (let key of chunk) {
      queue.delete(key);
    }

    return chunk;
  }

  let values = new Map();

  function next() {
    let chunk = getNextChunk();
    let promises /*: Array<Promise<mixed>> */ = [];

    for (let key of chunk) {
      running.add(key);
      promises.push(Promise.resolve(task(key)).then(result => {
        running.delete(key);
        values.set(key, result);

        if (queue.size) {
          return next();
        }
      }));
    }

    return Promise.all(promises);
  }

  return new Promise((resolve, reject) => {
    return next().then(resolve, reject);
  }).then(() => {
    return { safe, values };
  });
}

module.exports = taskGraphRunner;
