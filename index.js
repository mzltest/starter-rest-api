const express = require('express')
const app = express()
const db = require('@cyclic.sh/dynamodb')
const nanoid = require('nanoid/async')
const xss = require('xss');
const crypto = require('crypto')
const AWS = require("aws-sdk");
let fetch = require('node-fetch')
const https = require("https");
const agent = new https.Agent({
  rejectUnauthorized: false
})
const s3 = new AWS.S3()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
var options = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
  index: ['index.html'],
  maxAge: '30d',
  redirect: false
}
app.use(express.static('public', options))
// #############################################################################
// xssoptions = {
//   whiteList: {
//     b: [],
//     i: [],
//     u: [],
//     s: [],
//     em: [],
//     br:[]
//   }
// };
// 新建
app.post('/api/create', async (req, res) => {
  console.log(req.body)
  if(req.body.content.length>128*1024){

    res.json({ok:false,err:'too long,max 128K units'}).end()
    return
  }
  if (!('mtcaptcha-verifiedtoken'in req.body)){
    res.json({ok:false,err:'expecting mtcaptcha-verifiedtoken'}).end()
    return
  }
ctres=await fetch(`https://service.mtcaptcha.com/mtcv1/api/checktoken?privatekey=${process.env.MT_PRIVATE}&token=${req.body.mtcaptcha-verifiedtoken}`,{agent:agent});
ctjson=await ctres.json()
if (ctjson.success!=true){
  console.log('captcha fail:',ctjson)
  res.json({ok:false,err:'captcha failed'}).end()
  return
}
  postid=await nanoid.nanoid(16)
  //is captcha resp correct?we check it later
  item = await db.collection('posts').set(postid,{
 content: req.body.content
  })

  await s3.putObject({
    Body: JSON.stringify({key:"value"}),
    Bucket: "cyclic-doubtful-beret-frog-us-west-1",
    Key: `tmp/${postid}.html`,
}).promise()


  res.json({ok:true,data:postid}).end()
})

// 
app.get('/api/redir/:id', async (req, res) => {
  postid=req.params.id
  if (!('mtcaptcha-verifiedtoken'in req.query.mtcaptcha-verifiedtoken)){
    res.json({ok:false,err:'expecting mtcaptcha-verifiedtoken'}).end()
    return
  }

  ctres=await fetch(`https://service.mtcaptcha.com/mtcv1/api/checktoken?privatekey=${process.env.MT_PRIVATE}&token=${req.body.mtcaptcha-verifiedtoken}`,{agent:agent});
ctjson=await ctres.json()
if (ctjson.success!=true){
  console.log('captcha fail:',ctjson)
  res.json({ok:false,err:'captcha failed'}).end()
  return
}
  item = await db.collection('posts').get(postid)
  if (item){
s3url=await s3.getSignedUrl('getObject',{
  Bucket: "cyclic-doubtful-beret-frog-us-west-1",
  Key: `tmp/${postid}.html`,
  Expires:3600*6
}).promise()

res.redirect(s3url)
return
  }
 
  res.json({ok:false,data:'no such post'}).end()
  
})

app.get('/:id', async (req, res) => {
  postid=req.params.id
  res.send(`
  <!DOCTYPE HTML>
<html>	
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<!-- MTCap Code Start-->    
  <!-- Configuration to construct the captcha widget.
      Sitekey is a Mandatory Parameter-->
   
  <script>
    var mtcaptchaConfig = {
      "sitekey": "MTPublic-CD7kxsafx",
  
      "verified-callback": "mt_verifiedcb",
     };
   (function(){var mt_service = document.createElement('script');mt_service.async = true;mt_service.src = 'https://service.mtcaptcha.com/mtcv1/client/mtcaptcha.min.js';(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(mt_service);
   var mt_service2 = document.createElement('script');mt_service2.async = true;mt_service2.src = 'https://service2.mtcaptcha.com/mtcv1/client/mtcaptcha2.min.js';(document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(mt_service2);}) ();


   var mt_verifiedcb = function(eventObj) {
      window.location='/api/redir/${postid}?mtcaptcha-verifiedtoken='+eventObj.verifiedToken
   }
 </script>
</head>
<body>
<p>完成验证码以访问用户提交的html文件#${postid}。访问链接有效期6小时。</p>
      <div class="mtcaptcha"></div>
      
</body>
</html>
  `).end()
  
})
// Start the server
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`index.js listening on ${port}`)
})
