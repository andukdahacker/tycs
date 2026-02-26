import { BrowserRouter, Routes, Route } from 'react-router'

function Home(): React.ReactElement {
  return <div><h1>tycs</h1></div>
}

function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export { App }
