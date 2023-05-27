const express = require('express')
const app = express()
const db = require('@cyclic.sh/dynamodb')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
// var options = {
//   dotfiles: 'ignore',
//   etag: false,
//   extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
//   index: ['index.html'],
//   maxAge: '1m',
//   redirect: false
// }
// app.use(express.static('public', options))
// #############################################################################

// create redir
app.post('/api/create', async (req, res) => {
  console.log(req.body)

 
  
  item = await db.collection('links').get(req.body.path)
  if (item){
    if (item.password!=req.body.password){
      res.json({ok:false,err:'Existing link but wrong password'}).end()
      return
  }
  }
 
  resdata = await db.collection('links').set(body.path,{redir:body.url,password:body.password,ttl: Math.floor(Date.now() / 1000) + 3600*6})
  resdata = await db.collection('stats').set(body.path,{data:[],password:body.password,ttl: Math.floor(Date.now() / 1000) + 3600*6})
  //return 


  res.json({ok:true,data:resdata}).end()
})

//show stats
app.post('/api/stat/:path', async (req, res) => {
  console.log(req.body)
  path = req.params.path
 
  
  item = await db.collection('stats').get(path)
  if (item){
    if (item.password!=req.body.password){
      res.json({ok:false,err:'Existing stat but wrong password'}).end()
  }
  res.json({ok:true,data:item}).end()
  return
  }
 

  res.json({ok:false,err:'no such path in stat'}).end()

  
})

//show info
app.get('/api/info/:id', async (req, res) => {
  id=req.params.id
  console.log(`from collection: ${col} get key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection('infos').get(id)
  if(!item){
    res.json({ok:false,err:'no such item'}).end()
  }
  res.json({ok:true,data:item}).end()
})


function randomString(length, chars) {
  var result = '';
  for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// Get a single item
app.post('/api/go/:path', async (req, res) => {
  rString = randomString(4, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
  path = req.params.path
  go =await db.collection('links').get(path)
    if (go){
        //建一个info
        info=await db.collection('infos').set(toString(Date.now())+rString,{'headers':req.headers,'body':req.body})
        nowsec = Date.now() 
        //取stat
        stat=await db.collection('stats').get(path)
        if(!stat){
            stat={table:'stats',key:path,data:[],password:'Mzltest@233'}
            console.warn(`{$path} didnt found on stat,so we created a new one.that shouldnt happen.`)
        }
 
        console.log(stat.data)
        stat.data.push({key:rString,ts:nowsec})
        resa =await db.collection('stats').set(path,stat)
        res.json({ok:true,data:go.redir}).end()
    }else{
        res.json({ok:false,err:'no such key in link'}).end()
    }
  const key = req.params.key
  console.log(`from collection: ${col} get key: ${key} with params ${JSON.stringify(req.params)}`)
  const item = await db.collection(col).get(key)
  console.log(JSON.stringify(item, null, 2))
  res.json(item).end()
})



// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
