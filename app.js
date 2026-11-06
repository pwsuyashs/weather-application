// Weather data is fetched through a same-origin server-side proxy (api/weather.js)
// so the OpenWeatherMap API key is never shipped to the browser.
const apiurl = "/api/weather?city=";
const searchbox=document.querySelector(".sea input")
const weatherbutton=document.querySelector(".sea button")
const weathericon=document.querySelector(".weather-icon")

function showWeatherError(){
    document.querySelector(".hide").style.display="none"
    document.querySelector(".container").style.backdropFilter=""
}

async function checkweather(city){
    try{
        const response= await fetch(apiurl+encodeURIComponent(city));
        if(!response.ok){
            showWeatherError()
            return;
        }
        var data =  await response.json();
        if(!data || !data.main || !data.wind || !Array.isArray(data.weather) || !data.weather[0]){
            showWeatherError()
            return;
        }

        document.querySelector(".city").textContent = data.name;
        document.querySelector(".temp").textContent = Math.round(data.main.temp) + "°c";
        document.querySelector(".text").textContent = data.main.humidity + "%";
        document.querySelector(".text2").textContent = data.wind.speed + "km/hr";

        if(data.weather[0].main=="Mist"){
            weathericon.src= "image/mist.png"
        }
        else if (data.weather[0].main=="Clear"){
            weathericon.src="image/clear.png"
        }
        else if (data.weather[0].main=="Clouds"){
            weathericon.src="image/weather.png"
        }
        else if (data.weather[0].main=="Drizzle"){
            weathericon.src="image/drizzle.png"
        }
        else if (data.weather[0].main=="Rain"){
            weathericon.src="image/rain.png"
        }
        else if (data.weather[0].main=="Haze"){
            weathericon.src="image/haze.png"
        }
        else if (data.weather[0].main=="Smoke"){
            weathericon.src="image/Smoke.png"
        }

        document.querySelector(".hide").style.display="block"
        document.querySelector(".container").style.backdropFilter="blur(5px)"
    }catch(err){
        // Network failure, aborted request or malformed JSON body: fail closed and hide stale results.
        showWeatherError()
    }
}
weatherbutton.addEventListener("click", ()=>{
    checkweather(searchbox.value).catch(showWeatherError)
})



