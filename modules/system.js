
function startsim(t,s,seed){console.log("Starting Simulation");
		$("#controlpanel").hide();
		//netformSimulation(1000,1234,25)
		netformSimulation(t,seed,s)
		$("#start").addClass("disabled")
		}  //using minutes for now
function stopsim(){console.log("Stopping Simulation")}



//
//
// system controls
function systemControl(con,sta){
	console.log(con,sta)
	system.control[con]=sta

}
// output functions (todo move to separate file)

function solarMCSAPI(size,outputid){

			

 			API_MCS24.location.postcode.value="wr49rp"
            API_MCS24.panels[0].electrical_rating.value=size*1000
            API_MCS24.panels[0].pitch.value=15
            API_MCS24.panels[0].panel_count.value=1      



	$.post( "http://api-encraft.rhcloud.com/mcs24", API_MCS24)
  		.done(function( data ) {
  			
  			system.control.solar_output=data.annual_electrical_output.value
    		$("#"+outputid).val(system.control.solar_output);
 		 });

}


var system = {
	control:{
			discharge:true,
			slow_charge:true,
			import_cap:20,
			export_cap:50,
			solar_cap:200,
			solar_output:175800
		},
	tempsolar:{},
	events:[],
	paused:true,
	simStartDate: new Date(2017,4,1,0,0,0),
	simDateTime: new Date(2017,4,1,0,0,0),
	simtime:0,
	time:-1,
	log:[],
	plots:{
			capacityCurrent:{name:"Available Capacity (kWh)",x:[],y:[],type:"scatter"},
			capacityMax:{name:"Max Capacity (kWh)",x:[],y:[],type:"scatter"},
			energyFlow:{name:"Import/Export (kW)",x:[],y:[],type:"scatter"},
			population:{name:"Population",x:[],y:[],type:"scatter"},
			solar:{name:"Solar generation",x:[],y:[],type:"scatter"}
		},
	run:function(){runsystem(system.time)},
	tick:function(step){
		step>=0?system.time++:system.time--;
		this.run()
	}
}


//output functions
function jumptotime(t){system.time=t;visualise(system.log[system.time],system.time)}


function tickstep(v){system.tick(v)}

function tickstepcontrol(){
	if (system.paused){
			system.paused=false;
			system.tick(1);
			$("#control").text("Pause")
	}
	else {
			system.paused=true;;
			$("#control").text("Run")
	}

}

function playbackSpeed(v){
	x = 1* $("#timestep").val()
	x>0?$("#timestep").val(x-=100*v):1
	
}

function runsystem(stime){
	
	system.simDateTime = new Date(system.simStartDate.getTime())
	system.simDateTime.addMinutes(system.time)
	$("#systemtime").html(system.time + " | " + system.simDateTime); //getTimefromSystem(system.time));
	$("#jumpto").val(system.time);
	document.title = 'Netform' + "  |" + system.time + "/" + system.simtime ;
	visualise(system.log[system.time],system.time)
	//console.log(system.log[stime])
	if(!system.paused){if(stime<system.simtime){
						setTimeout(function(){ 
							system.tick(1)}, $("#timestep").val())};
					 }
}




function showVehicleList(list){
	out=""
	// sort by value
	list.sort(function (a, b) {
	  return a.s - b.s;
	});
	list.sort()
	for (i=0;i<list.length;i++){
		out+="<div class='veh'>" + list[i].s + ":" + list[i].message[0] + "</div>"
	}
	$("#list").html(out);
}

function visualise(arr,systemtime){

	system.simDateTime = new Date(system.simStartDate.getTime())
	system.simDateTime.addMinutes(system.time)
	$("#systemtime").html(system.time + " | " + system.simDateTime); //getTimefromSystem(system.time));

	out="";
	on="";
	qu="";
	ex="";
	ie=0;
	n=0;q=0;
	//console.log(arr)
	dArr=arr.Veh

	for (i=dArr.length-1;i>=0;i--){

			state="On charger"
			if(dArr[i].message.statusCode<0){state="Exited"}
			if(dArr[i].message.statusCode==0){state="In Queue"}
			
			colour="#ccc";
			alpha = dArr[i].message.rate<0?-1*dArr[i].message.rate/veh_maxchargerate:dArr[i].message.rate/veh_maxchargerate;
			if(dArr[i].message.chargeStatus<0){colour="rgba(100,0,0," + alpha + ")";}
			// if(dArr[i].message.chargeStatus==1){colour="darkgreen";}
			// if(dArr[i].message.chargeStatus==2){colour="lightgreen";}
			if(dArr[i].message.chargeStatus>0){colour="rgba(0,100,0," + alpha + ")";}

			
			battmaxcap = dArr[i].message.model.MaxCapacity
			Qicon = dArr[i].message.netform>=1?"glyphicon-tasks":"";
		//console.log(arr)
		//
		o=""
		o+="<tr>"
		o+="<td>" + dArr[i].s +  "</td>"
		o+="<td>" + dArr[i].message.model.Name + "</td>"
		o+="<td><span class='glyphicon "+ Qicon+"'></span></td>"
		o+="<td>" + state  +  "</td>"
		o+="<td style='width:60%'>"
		o+="<div class='status_vis' style='width:"+battmaxcap+"%'>"
		o+="<div class='veh_state_vis' style='background-color:"+colour+";width:"+dArr[i].message.percent+"%'></div>"
		o+="</div>"
		o+="</td>"
		o+="<td>"+ (1*dArr[i].message.rate).toFixed(2)+" kW</td>"
		o+="</tr>"



			// o=""
			// o+="<div class='veh'><div class='veh_id'>" + dArr[i].s +  "</div>";
			// o+="<div class='veh_status'>" + dArr[i].message.model.Name + "</div>";
			// o+="<div class='veh_status'>" + state + "</div>";
			// //if(state!="Exited"){
			// o+="<div class='veh_maxcap'><div class='status_vis' style='width:"+battmaxcap+"%'><div class='veh_state_vis' style='background-color:"+colour+";width:"+dArr[i].message.percent+"%'></div></div></div>"
			// o+="<div class='veh_state'>"+dArr[i].message.rate+" kW | NF:" + dArr[i].message.netform + "|" +dArr[i].message.chargeStatus + "|"+ dArr[i].message.netMod + "</div>"
			// //}
			// o+="</div>"
			
			out+=o

			if(state=="On charger"){on+=o;n+=1}
			if(state=="In Queue"){qu+=o;n+=1}	
			if(state=="Exited"){ex+=o}
			
			//ie+=1*dArr[i].message.rate

			//add rate * chargestatus to bin for import export


	}

	//show system events
	se=""

	for(i=0;i<system.events.length;i++){
		if(system.time>=system.events[i].start && system.time<=system.events[i].stop){
			se=system.events[i].type
		}
		
	}
	$("#systemevents").html(se)
	
	//current
	//
	//dt = system.simDateTime   // getTimefromSystem(system.time)
	//set graphs to contain all data to time..
	system.plots.capacityCurrent.x=[]
	system.plots.capacityCurrent.y=[]
	system.plots.capacityMax.x=[]
	system.plots.capacityMax.y=[]
	system.plots.energyFlow.x=[]
	system.plots.energyFlow.y=[]
	system.plots.population.x=[]
	system.plots.population.y=[]
	system.plots.solar.x=[]
	system.plots.solar.y=[]

	for (i=1;i<=systemtime;i++){
		dt=new Date(system.simStartDate.getTime())
		t= dt.addMinutes(i)  //getTimefromSystem(i)
		system.plots.capacityCurrent.x.push(t)
		system.plots.capacityCurrent.y.push(system.log[i].Cap.currentCap)

		system.plots.capacityMax.x.push(t)
		system.plots.capacityMax.y.push(system.log[i].Cap.maximumCap)


		//loop thorugh all vehicles and check rates 
		lie=0//loop ie
		//system.time==806?console.log(system.log[i].Veh):false
		for(v=0;v<system.log[i].Veh.length;v++){

				//system.time==806?console.log(systemtime,i,v,system.log[i].Veh[v].message.statusCode,system.log[i].Veh[v].s,system.log[i].Veh[v].message.rate,system.log[i].Veh[v].message.statusCode):false
			lie += system.log[i].Veh[v].message.statusCode==1?(1*system.log[i].Veh[v].message.rate):0;
		
		}
        //system.time==806?console.log(lie):false

		system.plots.energyFlow.x.push(t)
		system.plots.energyFlow.y.push(lie)//-system.log[i].Park.GenSolar)

		system.plots.population.x.push(t)
	    system.plots.population.y.push(system.log[i].Park.onSlot)

	    //add solar prediction...

 		system.plots.solar.x.push(t)
 		system.plots.solar.y.push(system.log[i].Park.GenSolar)

	}
	//system.plots.capacityCurrent.x.push(dt)
	//system.plots.capacityCurrent.y.push(arr.Cap.currentCap)
	//total capacity
	// system.plots.capacityMax.x.push(dt)
	// system.plots.capacityMax.y.push(arr.Cap.maximumCap)
	//import/export
	//
	
	// system.plots.energyFlow.x.push(dt)
	// system.plots.energyFlow.y.push(ie)
	//export
	
	// system.plots.population.x.push(dt)
	// system.plots.population.y.push(arr.Park.onSlot)
	
	$("#list").html("<tbody>"+on+"</tbody>")
	$("#queue").html("<tbody>"+qu+"</tbody>")
	$("#exit").html("<tbody>"+ex+"</tbody>")

   system.time  == 0?plot():replot();
}

function replot(){
		Plotly.redraw('plot_capacity');
		Plotly.redraw('plot_energy_flow');
		Plotly.redraw('plot_population');
		Plotly.redraw('plot_solar');
}
function plot(){
		var layout = {
		  showlegend: true,
		  legend: {
		    x: 0.1  ,
		    y: 1.2
		  }
		}

	

	Plotly.newPlot('plot_capacity', [system.plots.capacityCurrent,system.plots.capacityMax],layout);
	Plotly.newPlot('plot_energy_flow', [system.plots.energyFlow],layout);
	Plotly.newPlot('plot_population', [system.plots.population],layout);
	Plotly.newPlot('plot_solar', [system.plots.solar],layout);
}
//GUI

function saveSettingsfile(){
	//for each input in simulation div...
	out={}
	$("#simulation input").each(function(d){
		out[this.id]=this.value
	})
	 var data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out))
	 var dl = document.createElement('a');
  	dl.setAttribute('href', data);
 	dl.setAttribute('download',$("#seed").val()+".nfm");
  	dl.click();
}

function setSettings(setting){
	for (var s in setting){
		$("#"+s).val(setting[s])
	
	}
}