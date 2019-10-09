/** @jsx h */

import { h, render, useState, useEffect, useRef } from "../src/index"

const testRender = jsx => new Promise(resolve => {
  document.body.innerHTML = ""

  render(jsx, document.body, () => resolve([...document.body.childNodes]))
})

const testUpdates = async updates => {
  let effect = () => {}
  let setContent

  const Component = () => {
    const [content, _setContent] = useState(updates[0].content)

    setContent = _setContent

    useEffect(effect)

    return content
  }

  const run = index => updates[index].test([...document.body.childNodes])

  await testRender(<Component/>)

  run(0)

  for (let i=1; i<updates.length; i++) {
    await new Promise(resolve => {
      effect = () => {
        run(i)

        resolve()
      }

      setContent(updates[i].content)
    })
  }
}

const toString = elements => elements.map(child => child.outerHTML).join("")

test('render nested HTML elements, apply attributes', async () => {
  const elements = await testRender(<div><span class="foo">test</span></div>)

  expect(toString(elements)).toBe(`<div><span class="foo">test</span></div>`)
})

test('apply props to object properties', async () => {
  const elements = await testRender(<input defaultChecked={true}/>)

  expect(elements[0].defaultChecked).toBe(true)
})

test('render range of HTML elements', async () => {
  const elements = await testRender(<ul><li>1</li><li>2</li><li>3</li></ul>)

  expect(toString(elements)).toBe("<ul><li>1</li><li>2</li><li>3</li></ul>")
})

test('attach DOM event handler', async () => {
  let clicked = false

  const handler = () => clicked = true

  const elements = await testRender(<button onclick={handler}>OK</button>)

  elements[0].click()

  expect(clicked).toBe(true)
})

test('update components; use state and effect hooks', async done => {
  const Component = ({ effect }) => {
    const [count, setCount] = useState(0)

    useEffect(effect)

    const onClick = () => setCount(count + 1)

    return (
      <button onclick={onClick}>
        {count}
      </button>
    )
  }

  let effectCalled = false

  let afterEffect = () => effectCalled = true

  let elements = await testRender(<Component effect={() => afterEffect()}/>)

  expect(effectCalled).toBe(true)

  expect(elements[0].firstChild.nodeValue).toBe("0")

  afterEffect = checkEffect

  elements[0].click()

  function checkEffect() {
    expect(elements[0].firstChild.nodeValue).toBe("1")

    done()
  }
})

test('obtain reference to DOM element', async () => {
  const ref = useRef()

  const elements = await testRender(<div ref={ref}/>)

  expect(ref.current).toBe(elements[0])
})

test('reorder and reuse elements during key-based reconciliation of child-nodes', async () => {
  const states = [
    [1,2,3],
    [3,1,2], // shift right
    [1,2,3],
    [2,3,1], // shift left
    [1,2,3],
    [1,3],   // remove from middle
    [1,2,3],
    [2,3],   // remove first
    [1,2,3],
    [1,2],   // remove last
    [1,2,3],
    [3,2,1], // reverse order
    [1,2,3],
  ]

  let lastChildren

  await testUpdates(states.map((state, stateNumber) => ({
    content: (
      <ul>
        {state.map(value => <li key={value}>{value}</li>)}
      </ul>
    ),
    test: (elements) => {
      const children = [...elements[0].children]

      expect(children.map(el => el.textContent)).toStrictEqual(state.map(value => "" + value))

      if (stateNumber >= 1) {
        const lastState = states[stateNumber - 1]

        // console.log(`transition from ${lastState.join(", ")} to ${state.join(", ")}`)

        state.forEach((value, index) => {
          const lastIndex = lastState.indexOf(value)

          if (lastIndex !== -1) {
            // console.log(`item ${value} position ${lastIndex} -> ${index}`)

            expect(children[index]).toBe(lastChildren[lastIndex])
          }
        })
      }

      lastChildren = children
    }
  })))
})
