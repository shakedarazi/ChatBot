import { useEffect, useState } from "react"
import { Button } from "./components/ui/button";

function App() {

    const[message,setMassage]=useState('');

    useEffect(()=>{
      fetch('api/hello')
      .then(res=>res.json())
      .then(data=>setMassage(data.message));
    },[]);
    return( 
    <>
    <p className="font-bold p-4 text-3xl"> {message}</p>
    <Button>click me</Button>
    </>
    )

}

export default App
