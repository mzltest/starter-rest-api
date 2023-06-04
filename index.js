const express = require('express')
const app = express()
const db = require('@cyclic.sh/dynamodb')
const nanoid = require('nanoid/async')
const crypto = require('crypto')
const https = require("https");
const agent = new https.Agent({
  rejectUnauthorized: false
})
const allimgs=require('./allimgs.json')
const sharp = require('sharp')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
var options = {
  dotfiles: 'ignore',
  etag: true,
  extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
  index: ['index.html'],
  maxAge: '30d',
  redirect: false
}
app.use(express.static('public', options))
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //不含最大值，含最小值
}

function getRandomArrayElements(arr, count) {
  var shuffled = arr.slice(0), i = arr.length, min = i - count, temp, index;  //只是声明变量的方式, 也可以分开写
  while (i-- > min) {
      //console.log(i);
      index = Math.floor((i + 1) * Math.random()); //这里的+1 是因为上面i--的操作  所以要加回来
      temp = shuffled[index];  //即值交换
      shuffled[index] = shuffled[i]; 
      shuffled[i] = temp;
      //console.log(shuffled);
  }
  return shuffled.slice(min);
}

// a b c in [0,3)
// 新建
app.get('/api/create', async (req, res) => {
  imgs=[]
  f1=getRandomInt(0,3)
  f2=getRandomInt(0,3)
  f3=getRandomInt(0,3)
  reference=[f1,f2,f3].join('-')
  pendimgs=getRandomArrayElements(allimgs[reference],4)
  for(i=0;i<5;i++){
    a1=getRandomInt(0,3)
    a2=getRandomInt(0,3)
    a3=getRandomInt(0,3)
    if(a1==f1&&a2==f2&&a3==f3){
      switch (a1%3){
        case 0:
          a2=(a2+1)%3
          break
        case 1:
          a3=(a3+1)%3
          break
        case 2:
          a1=(a1+1)%3
          break
      }
    }
    rndimg=[a1,a2,a3].join('-')
    pendimgs.push(allimgs[rndimg][getRandomInt(0,allimgs[rndimg].length)])
  }
  console.log(pendimgs)
  for (im of pendimgs){
    
    tempim=await sharp(`./cpb/${im}`).blur(Math.random()*10).resize({ width: 256 }).toBuffer()
    nid=await nanoid.nanoid(6)
    imgs.push({'base64':tempim.toString('base64'),id:nid})

  }
  answer=[]
  for (i=0;i<4;i++){
    answer.push(imgs[i].id)
  }
  answer=answer.sort()
  console.log(answer)
  imgs=imgs.sort(() => Math.random() - 0.5)
  cid=await nanoid.nanoid(16)
  await db.collection('challenges').set(cid,{answer:answer,src:req.ip, ttl: Math.floor(Date.now() / 1000) + 300,passed:false,attempt:0})
  res.json({ok:true,data:imgs,id:cid}).end()
  return
})

// 
app.get('/api/verify/:id/:answer', async (req, res) => {
  cid=req.params.id
  answer=req.params.answer
  chal=await db.collection('challenges').get(cid)
  if (!chal){
    res.json({ok:false,err:'no such challenge',reload:false}).end()
    return
  }
  if (chal.ttl> (Math.floor(Date.now() / 1000) + 300)){
    res.json({ok:false,err:'challenge expired',reload:true}).end()
    return
  }
  if (chal.src!=req.ip){
    res.json({ok:false,err:'ip didnt match'}).end()
    return
  }
  answer=answer.sort()
  if(chal.answer!=answer){
    if(chal.attempt<2){
      chal.attempt+=1
      await db.collection('challenges').set(cid,chal)
      res.json({ok:false,err:'incorrect answer',reload:false}).end()

      return
    }
    await db.collection('challenges').delete(cid)
    res.json({ok:false,err:'incorrect answer',reload:true}).end()

    return
  }

  chal.passed=true
  chal.ttl=Math.floor(Date.now() / 1000) + 300
  await db.collection('challenges').set(cid,chal)
  res.json({ok:true,data:cid}).end()
  
})


app.get('/api/check/:id', async (req, res) => {
  cid=req.params.id
  chal=await db.collection('challenges').get(cid)
  res.json({ok:true,data:chal,passed:chal.passed}).end()
  
})
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
