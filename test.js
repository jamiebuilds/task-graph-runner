// @flow
'use strict';
const test = require('ava');
const taskGraphRunner = require('./');

function createTask(order) {
  return item => {
    order.push(`${item}:start`);
    return Promise.resolve().then(() => {
      order.push(`${item}:end`);
      return item.toUpperCase();
    });
  };
}

test('empty graph', t => {
  let graph = new Map([]);
  let task = () => t.fails();
  return taskGraphRunner({ graph, task }).then(res => {
    t.is(res.safe, true);
    t.deepEqual(Array.from(res.values), []);
  });
});

test('graph with no dependencies', t => {
  let graph = new Map([
    ['a', []],
    ['b', []],
    ['c', []],
    ['d', []],
  ]);
  let order = [];
  let task = createTask(order);
  return taskGraphRunner({ graph, task }).then(res => {
    t.is(res.safe, true);
    t.deepEqual(Array.from(res.values), [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D']
    ]);
    t.deepEqual(order, [
      'a:start',
      'b:start',
      'c:start',
      'd:start',
      'a:end',
      'b:end',
      'c:end',
      'd:end',
    ]);
  });
});

test('graph with multiple dependencies on one item', t => {
  let graph = new Map([
    ['a', ['d']],
    ['b', ['d']],
    ['c', []],
    ['d', []],
  ]);
  let order = [];
  let task = createTask(order);
  return taskGraphRunner({ graph, task }).then(res => {
    t.is(res.safe, true);
    t.deepEqual(Array.from(res.values), [
      ['c', 'C'],
      ['d', 'D'],
      ['a', 'A'],
      ['b', 'B']
    ]);
    t.deepEqual(order, [
      'c:start',
      'd:start',
      'c:end',
      'd:end',
      'a:start',
      'b:start',
      'a:end',
      'b:end',
    ]);
  });
});

test('graph with cycle (force: true)', t => {
  let graph = new Map([
    ['a', ['b']],
    ['b', ['c']],
    ['c', ['d']],
    ['d', ['a']],
  ]);
  let order = [];
  let task = createTask(order);
  return taskGraphRunner({ graph, task, force: true }).then(res => {
    t.is(res.safe, false);
    t.deepEqual(Array.from(res.values), [
      ['a', 'A'],
      ['d', 'D'],
      ['c', 'C'],
      ['b', 'B']
    ]);
    t.deepEqual(order, [
      'a:start',
      'a:end',
      'd:start',
      'd:end',
      'c:start',
      'c:end',
      'b:start',
      'b:end',
    ]);
  });
});

test('graph with cycle (force: false)', t => {
  t.plan(1);
  let graph = new Map([
    ['a', ['b']],
    ['b', ['c']],
    ['c', ['d']],
    ['d', ['a']],
  ]);
  let task = createTask([]);
  return taskGraphRunner({ graph, task, force: false }).catch(err => {
    t.pass();
  });
});

test('graph with cycle with multiple unblocked deps', t => {
  let graph = new Map([
    ['a', ['d']],
    ['b', ['d']],
    ['c', ['d']],
    ['d', ['a']],
  ]);
  let order = [];
  let task = createTask(order);
  return taskGraphRunner({ graph, task, force: true }).then(res => {
    t.is(res.safe, false);
    t.deepEqual(Array.from(res.values), [
      ['d', 'D'],
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
    ]);
    t.deepEqual(order, [
      'd:start',
      'd:end',
      'a:start',
      'b:start',
      'c:start',
      'a:end',
      'b:end',
      'c:end',
    ]);
  });
});

test('graph with multiple cycles', t => {
  let graph = new Map([
    ['a', ['b']],
    ['b', ['a']],
    ['c', ['d']],
    ['d', ['c']],
  ]);
  let order = [];
  let task = createTask(order);
  return taskGraphRunner({ graph, task, force: true }).then(res => {
    t.is(res.safe, false);
    t.deepEqual(Array.from(res.values), [
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
    ]);
    t.deepEqual(order, [
      'a:start',
      'a:end',
      'b:start',
      'b:end',
      'c:start',
      'c:end',
      'd:start',
      'd:end',
    ]);
  });
});

test('task fails on one item', t => {
  t.plan(1);
  let graph = new Map([
    ['a', []],
    ['b', ['a']],
    ['c', []],
    ['d', ['c']],
  ]);
  let order = [];
  let task = item => {
    order.push(`${item}:start`);
    return Promise.resolve().then(() => {
      if (item === 'a') {
        order.push(`a:error`);
        throw new Error('oops');
      }
      order.push(`${item}:end`);
    });
  };
  return taskGraphRunner({ graph, task, force: true }).catch(res => {
    t.deepEqual(order, [
      'a:start',
      'c:start',
      'a:error',
      'c:end',
      'd:start',
      'd:end',
    ]);
  });
});
