const express = require('express')
const app = express()
const db = require('@cyclic.sh/dynamodb')
const nanoid = require('nanoid/async')
const crypto = require('crypto')
const https = require("https");
const { exec } = require("child_process");
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
function shuffle(array) {
	var j, x, i;
	for (i = array.length; i; i--) {
		j = Math.floor(Math.random() * i);
		x = array[i - 1];
		array[i - 1] = array[j];
		array[j] = x;
	}
	return array;
}

app.post('/api/html2img', async (req, res) => {
content=req.body.content
url=req.body.url
usepng=req.body.png
filename=await nanoid.nanoid(6)+(usepng?'.png':'.jpg')
size=req.body.size
exec('mkdir ~/.fonts')
exec('cp NotoSans-Regular.ttf ~/.fonts/')
exec('fc-cache -fv ~/.fonts/')
exec('chmod +x ./phantomjs')
if (!url){
 url=`data:text/html,${content}`
}
exec(`./phantomjs rasterize.js "${url}" /tmp/${filename} ${size}`)
res.sendFile(`/tmp/${filename}`)
exec(`rm -rf /tmp/*`)
})

// a b c in [0,3)
// 新建
app.get('/api/create/:state', async (req, res) => {
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
    
    tempim=await sharp(`./cpb/${im}`).blur(getRandomInt(40,400)/100).resize({ width: 256 }).toBuffer()
    nid=await nanoid.nanoid(6)
    imgs.push({'base64':tempim.toString('base64'),id:nid})

  }
  answer=[]
  for (i=0;i<4;i++){
    answer.push(imgs[i].id)
  }
  answer=answer.sort().join('|')
  console.log(answer)
  imgs=shuffle(imgs)
  cid=await nanoid.nanoid(24)
  await db.collection('challenges').set(cid,{answer:answer, ttl: Math.floor(Date.now() / 1000) + 300,passed:false,state:req.params.state})
  res.json({ok:true,data:imgs,id:cid}).end()
  return
})

// 
app.get('/api/verify/:id/:answer', async (req, res) => {
  cid=req.params.id
  answer=req.params.answer
  answer=answer.split('|').sort().join('|')
  chal=await db.collection('challenges').get(cid)

  if (!chal){
    res.json({ok:false,err:'no such challenge',reload:true}).end()
    return
  }
  chal=chal.props
  console.log(answer)
  if (chal.ttl< (Math.floor(Date.now() / 1000))){
    res.json({ok:false,err:'challenge expired',reload:true}).end()
    return
  }

  
  if(chal.answer!=answer){

    console.log(chal.answer)
    await db.collection('challenges').delete(cid)
    res.json({ok:false,err:'incorrect answer',reload:true}).end()

    return
  }

  await db.collection('solved').set(cid,{passed:true,ttl:(Math.floor(Date.now() / 1000) + 300),src:req.headers['x-forwarded-for'],state:chal.state})
  await db.collection('challenges').delete(cid)
  res.json({ok:true,data:cid}).end()
  
})


app.get('/api/check/:id', async (req, res) => {
  cid=req.params.id
  chal=await db.collection('solved').get(cid)
  if(!chal){
    res.json({ok:false,err:'no such challenge in solved'}).end()
    return
  }
  chal=chal.props
  if (chal.ttl<(Math.floor(Date.now() / 1000))){
    res.json({ok:false,err:'challenge expired'}).end()
    return
  }
  await db.collection('solved').delete(cid)
  res.json({ok:true,data:chal,passed:chal.passed,state:chal.state,src:chal.src}).end()
  
})
app.get('/:state', async (req, res) => {
  res.redirect(`/?state=${req.params.state}`)  
})
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
