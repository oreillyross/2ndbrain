import {trpc} from "./lib/trpc"

function App() {
  
   const { data, isLoading } = trpc.health.ping.useQuery();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <>
      <section id="center">
        <div className="hero">
          <div>
            <h1 className='text-3xl text-blue-600'>tRPC test</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
         
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
