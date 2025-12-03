import { useEffect, useState } from "react"

function App() {

    const[message,setMassage]=useState('');

    useEffect(()=>{
      fetch('api/hello')
      .then(res=>res.json())
      .then(data=>setMassage(data.message));
    },[]);
    return <p>{message}</p>

}

export default App
