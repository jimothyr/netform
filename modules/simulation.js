//using sim.js library from http://simjs.com/   **updated version avialble @https://github.com/btelles/simjs-updated


//ADD CHARGE DISCHARGE EVENTS..
//START SIMPLE.. 


console.clear()//lets start with a clean console.


function netformSimulation(SIMTIME,SEED,SLOTS,STARTDATE){
	//set simulation parameters
	var sim = new Sim("Netform");
	sim.startDateTime=new Date(2017,04,01,0,0,0)
	sim.currentDateTime=function(){
			d=new Date(sim.startDateTime.getTime())
			d.addMinutes(sim.time())
		return d
	}
	console.log(sim)
	var random = new Random(SEED);
	var number_of_vehicles=0
	//make events
	//external events
	//demand for FFR, store, import, export
	//arrival of vehicles... trains,  airplanes.

	//add capacity check event

	// add logging array
	// 

	var Park = new Sim.Facility("park", Sim.Facility.FCFS,SLOTS)//this manages timing and queuing
	Park.report = function(){console.log(this)};
	Park.caps = function(){
	
		  st = sim.entities
		  ca = 0;
		  cu = 0;
		  if (st.length>1){
				for (i=1;i<st.length;i++){
					if(st[i].statusCode == 1){
						cu+=st[i].current
						ca+=st[i].model.MaxCapacity
					}				
				}
		  }
		return {currentCap:cu,maximumCap:ca};
	};
	Park.status = function(){
			f=  this.free //number of aviable slots
			q=  this.queue.data.length//population in queue
			ps= this.stats.population - q;
			pq=q;
			t=this.total
			pe=t-this.stats.population;
			// s=sim.entities

			return {SlotsFree:f,onSlot:ps,Queue:pq,Exited:pe,Total:t,GenSolar:this.solarGeneration.tickOutput(sim.currentDateTime(),sim.time())}
	}
	Park.total= 0;
	Park.inQueue = function(id){
			q=1;
			t=this.queue.data;
			for (i=0;i<t.length;i++){
					if(t[i].entity.id===id){q=0}
				}
			//console.log(id,q,sim.time(),this.queue.data)
			return q;
	};
	Park.solarGeneration = {
		profile:{},
		init:function(){
			//get profile and adjust for system size.
			//turn daily into actual..
			for(i=0;i<profile_solar.length;i++){
				monthly = profile_solar[i].Monthly*system.control.solar_output
				data=[];
				for (j=0;j<24;j++){
					data.push(profile_solar[i][j]*monthly/2)
					data.push(profile_solar[i][j]*monthly/2)//do again for 23 period data//remove this for 48 period data
				}

				this.profile[profile_solar[i].Month]={"monthly":monthly,"data":data}
			}
		},
		periodOutput:function(datetime,period){
			//console.log(this.profile[month],this.profile[month].data[10])
			// console.log(datetime)
			month = datetime.getMonthName().substring(0,3)
			diM = datetime.getDaysInMonth()
			return this.profile[month].data[period]/diM
		},
		tickOutput:function(datetime,tick){
			//interpolate solar output to each minute (tick)
			period = Math.floor(tick/30)
 			period =  period > 47 ? 0: period
 			genSolar =  Park.solarGeneration.periodOutput(sim.currentDateTime(),period)


			return this.profile[month].data[period]/Date.getDaysInMonth(2017, Date.getMonthNumberFromName(month))
		}
	}
	Park.batteryStorage = {}

	Park.solarGeneration.init()

	//create slot array. this allows specific slots to have specific chargers...
	var Slot= {
		type:"Standard",
		modes:[3,7,22]
	}

	var generation={//todo - currently not used,,, needs to include multiple solar arrays/generation
		// profile:{},
		// start:function(){
		// 	//get profile and adjust for system size.
		// 	//turn daily into actual..
		// 	//get solar profile data
			
		// 	for(i=0;i<profile_solar.length;i++){
		// 		monthly = profile_solar[i].Monthly*system.control.solar_output
		// 		data=[];
		// 		for (j=0;j<24;j++){
		// 			data.push(profile_solar[i][j]*monthly)
		// 			data.push(profile_solar[i][j]*monthly)//do again for 23 period data
		// 		}

		// 		this.profile[profile_solar[i].Month]={"monthly":monthly,"data":data}
		// 	}
		// },
		// periodOutput:function(month,period){
		// 	//console.log(this.profile[month],this.profile[month].data[10])
		// 	return this.profile[month].data[period]/Date.getDaysInMonth(2017, Date.getMonthNumberFromName(month))
		// },
		// tickOutput:function(month,tick){
		// 	//interpolate solar output to each minute (tick)
		// 	period = Math.floor(tick/30)
 		// 	period =  period > 47 ? 0: period
 		// 	genSolar =  Park.solarGeneration.periodOutput(month,period)


		// 	return this.profile[month].data[period]/Date.getDaysInMonth(2017, Date.getMonthNumberFromName(month))
		// }
	}

	var storage={}

	var Vehicle = {
		statustext:"Awaiting charge point",
		statusCode:0,// 0 - in queue, 1-on charge point , -1 - exited
		chargeStatus:0, // 0 = not charging  // 1 = mode 1 charging   2= mode 2 charging // -1 mode 1 discharging  // -2 mode 2 discharging
		chargeStart:0,// time from start charging (for ramp up time)
		netformStatus:0,//0=not affect, number = modulation
		netformModulation:1,
		prediction:{},//provides netform control for modulating rate/discharge...
		state:"",
		NF_vehStatus:[],
		Constraints:[],
		log:[],
		model:"",
		user:"",
		current:0,
		rate:0,//negative for discharge/positive for charge
		//netformFactor:0
		netFF:0,//set using netformfactor function
		netFFPredicted:0,
		arrival:0,
		onSlotTime:0,
		departure:0,
		departureTime:0,
		facilitySlot:0,
		command:0, //default is charge //will need to object at some point to enable fast,slow chage and discharge/ currently is  
		charge:function(live){//live uses NF modulator, and updates this..  --- not live updates prediction object..
			//if(this.id==2){console.log(live,sim.time(),this.current,this.prediction)}
			switch(this.statusCode){

				case 1: //on charge point
						//capture current conditions for prediction run/
						rate=this.rate
						current=this.current
						chargeStatus=this.chargeStatus
						chargeStart=this.chargeStart
						this.netformFactor();
						//run negotiation to set modulator....
						//
						//
						//this.netformModulation = this.negotiation()
						
						//add ramp up time (use rd???)
						chargeStatus=this.command //default to request						
						// if netform factor requires then charge me.
						if (this.netFF>1){chargeStatus=1}//fire netform....
							
						if((current/this.model.MaxCapacity)>this.model.C_RDC && chargeStatus>0){chargeStatus=2}//slow drop towards top.
						if(chargeStatus==0 && system.control.slow_charge){chargeStatus=2}

						//do negotiation here...
						//
						neg=live?this.negotiation(chargeStatus,rate):{"status":chargeStatus,"rate":rate}

						chargeStatus=live?neg.status:chargeStatus;
						netformModulation=live?neg.rate:1;


						//this.id==2&&live?console.log(sim.time(),this.netFF,this.netFFPredicted,netformModulation):false
						
						//(this.id==6&&sim.time()>500&&sim.time()<550&&live)?console.log(sim.time(),chargeStatus,neg.rate,rate):false;
						if (this.model.MinCharge <= current && current <= this.model.MaxCapacity){// if able to charge/discharge.
						//	this.chargeStatus = this.command;//accept request // following  if statements  qualify
							//rd=1//rate direction + charging - discharging and ramp time
							switch (chargeStatus){
								case 2:
									rate=netformModulation*this.model.C_Rate2;
									chargeStart++;
									chargeStart=chargeStart<0?1:chargeStart;
									rate=chargeStart<this.model.C_RUT?(rate*chargeStart/this.model.C_RUT):rate;	

								break;
								case 1: //charge
									rate=netformModulation*this.model.C_Rate1;
									chargeStart++;
									chargeStart=chargeStart<0?1:chargeStart;
									rate=chargeStart<this.model.C_RUT?(rate*chargeStart/this.model.C_RUT):rate;
									
								break;
								case -1: //discharge at default
									rate=netformModulation*-1*this.model.D_Rate;
									//rate=rate>0?-1*rate:rate;
									chargeStart--;
									chargeStart=chargeStart>0?-1:chargeStart;
									rate=chargeStart>-1*this.model.C_RUT?(rate*chargeStart/this.model.C_RUT):rate;

								break;
								case 0: //hold
									rate=0;
									chargeStart=0
								break;
								default:
							}
						};

						//l=live?this.negotiation():false
						//modulation_rate=live?this.netformModulation:1; //set the factor is live run, use 1 if prediction run.
						//rate=modulation_rate*rate
						//chargeStatus=modulation_status
						//if(this.id==2){console.log(sim.time(),live,this.current,rate,modulation_rate,chargeStatus,this.netformFactor())}

						current +=  rate/60;

						if (Math.abs(rate)<1){
							rate=0;
							chargeStatus=0;
						}
						
						if(current > this.model.MaxCapacity && rate>0){
							current = this.model.MaxCapacity;
							rate=0;//add default to do nothing...
							chargeStatus=0;//default
							}

						if(current < this.model.MinCharge && rate<0){
							current = this.model.MinCharge;
							rate=0;//add default to do nothing...
							chargeStatus=0;//default
							}

						//if not prediction
						if(live){
							this.rate=rate
							this.current=current
							this.chargeStatus=chargeStatus
							this.chargeStart=chargeStart

							//return true;
						}
						else
						{
							this.prediction = {
								rate:rate,
								current:current,
								chargeStatus:chargeStatus,
								chargeStart:chargeStart,
								netform:this.netFFPredicted
								
							}
							this.charge(true);
							//return false;
						}
						
						//console.log(sim.time(),this.id,this.NF_vehStatus)
						// //*******************************
						// neg=this.negotiation()
						// this.rate=neg.rate;
						// this.chargeStatus=neg.chargeStatus
						// //this is the good stuff
						// //*********************************
						// //
				break;
				default:
				}
			},
		negotiation:function(cStatus,cRate){
			v=this.NF_vehStatus
			//if(this.id==4){console.log(v)}
			//oRate=this.rate;
			//oCS=this.chargeStatus;
			this.netformStatus=cStatus;//pass through from calc by default
			this.netformModulation=1;
			aRate=0;  //message.
			nfRate=0;
			rate=0;
			nfList=[]
			list=[];
			tList=[];
			nfMod=1;//modulate rate.... nf
			
			//Mod=1;//modulate rate other
			//if(this.id==4){sim.time(),console.log(v)}
			//set up data streams
			for(i=0;i<v.length;i++){
				if(v[i].message.statusCode!=1){continue;}

				//v[i].s==6?console.log(v[i]):false
					x=v[i].message.prediction;
					//rd=(x.chargeStatus>=0?1:-1)
					tList.push(v[i])
					aRate += (1*x.rate);//get max rate..
					if(x.netform>1){//add netform >1 to arr
						nfList.push(x);
						nfRate+=(1*x.rate)}
					else{
						list.push(x);
						rate+=(1*x.rate)};
					
				
			}
			//(this.id==6&&sim.time()>475&&sim.time()<490)?console.log(sim.time(),cStatus,this.statusCode):false
			//check against capacity (import)
			//if(this.Constraints[0])
			//
			//
			//
			//
			//Cap scenario
			//1. NF is below; others are above>>modulate others
			//2. NF is above;>>switch off others; modulate NF (based on weighting??) 
			//3. NF is above >> discharge others to meet demand...
			//4. NF is above >> modulate NF based on NF size....
			//
			//demand scenario
			//1.discharge of xxx for x mins
			//2.charge of xxx for x mins

			period = Math.floor(sim.time()/30)
 			period =  period > 47 ? 0: period
 			genSolar =  Park.solarGeneration.periodOutput(sim.currentDateTime(),period)

			importcap=this.Constraints.importCap;
			exportcap=-this.Constraints.exportCap;
			//Capacity scenarios

			//scenario 1: all is fine
			NFmodRate=1
			nonNFModRate=1
			NFStatus=this.netformStatus
			nonNFStatus=this.netformStatus

			//genSolar=0
			//adjust capacity limits for solar generation
			importcap=importcap+genSolar
			exportcap=exportcap-genSolar

			if(this.Constraints && aRate>=importcap){
				//scenario 2: NF is good, other modulate,,
				nonNFModRate = (importcap-nfRate)/rate;  // first modulate non nf leaving nf
				NFmodRate=1;
				//scenario 3: NF is over > stop other, modulate NF
				if (nfRate>importcap){
						nonNFModRate=0;
						nonNFStatus=0;
						NFmodRate=(importcap)/nfRate
						//console.log(sim.time(),NFmodRate)
					}
			}

			if(this.Constraints && aRate<=exportcap ){
				//scenario 4: discharge cap	
				nonNFModRate = (exportcap)/aRate;  // first modulate non nf leaving nf				
			}

			//what am i , what should i do...
			this.netformModulation=this.netFF>1?NFmodRate:nonNFModRate;



		//	this.netformModulation=nfMod
			this.netformStatus=this.netformModulation==0?0:NFStatus
			//this.netformStatus=this.chargeStatus
			

			this.id==7&&sim.time()<810?console.log(sim.time(),nfRate,this.netformModulation,this.netformStatus,this.netFF):false;



		//this.id==2?
		return{rate:this.netformModulation,status:this.netformStatus}
			//if(this.id==4){console.log(nfList,nfRate,list,rate,aRate)}
			//this is the key to the whole thing.
			//we need to check everyone is happy with what they are going to do......
			//
			//1. add up netforms
			
			//2. if import headroom then modulate everyone else to keep under headroom 
			//3. if no import headroom then get excess from netforms
			//4. discharge all at modulated rate for cover excess.
		
	    },
		netformFactor:function(){
				 time_to_depart = this.onSlotTime+this.user.duration-sim.time(); //this.arrival+this.user.duration-sim.time();//user.timeend-system.time;

				 //include top RDC current drop
				 charge_throttle_threshold = this.model.MaxCapacity*this.model.C_RDC
				  remain_charge_high = charge_throttle_threshold-this.current

				  remain_time_high = remain_charge_high > 0 ?
				  						remain_charge_high / (this.model.C_Rate1/60):
				  						0;

				  remain_charge_low = this.current >=charge_throttle_threshold ?
				  	   					this.model.MaxCapacity-this.current:
				  						this.model.MaxCapacity-charge_throttle_threshold;

				  remain_time_low = remain_charge_low/(this.model.C_Rate2/60)
			     time_to_full = remain_time_low + remain_time_high

			     //nff= (time_to_full/time_to_depart).toFixed(3)
				 this.netFF = (time_to_full/time_to_depart).toFixed(3)//nff  //time_to_end //nF //(1/nF).toFixed(2)
				 this.netFFPredicted=((time_to_full)/(time_to_depart-1)).toFixed(3)
				 return this.netFF//true;
			},
		selfCharge:function(){//if not given any commands then charge if netform requires.
					//this should override any message commands..
					//this.netformFactor();
					//if(this.netFF>=1){
					//		this.command=1;
					//	}
					//	else {this.command=2}
					//this.command=2;
					this.checkQueue();
					//this.command=2;
				
					this.charge(false)
				//	this.charge(false);//do prediction...
					this.setTimer(1).done(function(){this.selfCharge()});//loop control
					
		},
		leavefacility:function(){
			
        		this.departure = sim.time();//this.arrival + this.user.duration;
        		this.facilitySlot = 0;
        		this.statusCode = -1;
        		this.statusText="Exited";
        		this.chargeStatus=0;
        		this.rate=0;
        		},
	    start: function () {
	    	    //number_of_vehicles++
	    		//stats_vehicles.record(number_of_vehicles,sim.time());
		    	//get vehicle type,set user and current state of charge
		    	this.model=vArr[(random.random()*(vArr.length-1)).toFixed(0)];
		    	this.user=uArr[(random.random()*(uArr.length-1)).toFixed(0)];
	 			this.current=random.uniform(1, this.model.MaxCapacity);//current battery charge

		        var useDuration = this.user.duration//TODO - add normal around this number
		     	//arrive
		        this.arrival=sim.time();
		        Park.total++;
		        this.useFacility(Park, useDuration)//facility manages time and departure
		        	.done(this.leavefacility)
		        	//.waitUntil(10,this.leavefacility())
		        	.setData(this.id);
		        //set next 
		        this.checkQueue();
		        this.selfCharge();
		       

	    		},
	    checkQueue:function(){//while in queue check and set inque = false once entered facility
	    		//console.log(sim.time(),this.id,Park.inQueue(this.id))
	    		switch(this.statusCode){
	    			case -1:
	    				this.statusText="Gone baby gone"
	    				this.statusCode=-1;
	    			break;
	    			case 0:
		    			this.status="Awaiting charge point!"
		    			this.statusCode=0;
		    			this.statusCode=Park.inQueue(this.id);
		    			 if(this.statusCode==1){this.onSlotTime=sim.time();}
	    			break;
	    			case 1:
	    				this.statusText="on point";
	    			break;

	    		}
	    },
	    onMessage:function(s,m){
	    		this.checkQueue()
	    		if(Park.inQueue(this.id)){this.status="Awaiting charge point"}
	    		switch (m.c){
	    			case "status":
	    				this.NF_vehStatus = m.data;
	    				this.Constraints = m.control;

	    				st = (100*this.current/this.model.MaxCapacity).toFixed(0)
	    				this.send({statusCode:this.statusCode,
	    						   rate:this.rate.toFixed(4),
	    						   percent:st,
	    						   netform:	this.netFF,//this.netformFactor(),//this.netFF,
	    						   chargeStatus:this.chargeStatus,
	    						   model:this.model,
	    						   user:this.user,
	    						   arrival:this.arrival,
	    						   departure:this.departureTime,
	    						   prediction:this.prediction,
	    						   netMod:this.netformModulation
	    							},
	    						   0,
	    						   s);
	    			break;
	    			case "charge":
	    			//when import is required...
	    				//this.command=1;this.charge();
	    				//add in automatic charge at slow rate to 60% lowest expected??.. before high rate if NFF
	    			break;
	    			case "discharge":
	    				this.command=-1;//this.charge();

	    			break;
	    				case "hold":
	    				this.command=0;
	    			break;
	    			default:
	    		}
	    	},

	    finalize:function(){},
	}


//controller - starts,stops and provided global functions for the sim
 	var Controller = {
 		log:[],
 		vehStatus:[],
 		vehlog:[],
 		dischargeEvents:[],
 		Constraints:{},
 		sendTick:function(){
 							this.setTimer(1).done(function(){this.sendTick()})
 						},
 		askStatus:function(){
				 			period = Math.floor(sim.time()/30)
				 			period =  period > 47 ? 0: period
				 			genSolar =  Park.solarGeneration.periodOutput(sim.currentDateTime(),period)
 							system.log.push({Veh:this.vehStatus,Cap:Park.caps(),Park:Park.status()})
 			               	this.vehStatus=[];

 			               	//request data from vehicle...
 							this.send({c:"status",data:this.vehStatus,control:this.Constraints},0);
 							this.setTimer(1).done(function(){
								this.askStatus()
							})
 						},
 		askCommand:function(){this.send({c:"charge",data:this.vehStatus},0)},
 		periodTick:function(){//set 30min related items
 								period = Math.floor(sim.time()/30)
 								period =  period > 47 ? 0: period
		        				nextPeriod = period+1 > 47 ? 0: period+1
		       					previousPeriod = period-1 > 0 ? period-1:47
		        				periodPop = Cp[period]*SLOTS
		        				previousPeriodPop = sim.time()<30 ? 0: Cp[previousPeriod]*SLOTS
		        				addPop = periodPop - previousPeriodPop
		        				addPop =  addPop<=0?0:addPop
		        				this.vehArrival(addPop,sim.time(),sim.time()+30)
 								//console.log(period,periodPop,previousPeriodPop,addPop)
			 					this.setTimer(30).done(function(){//do it again
			 								this.periodTick();
			 					})
 		},
 		vehArrival:function(pop,start,stop){//deals with 30 tick period...
 			//frquency for next
 			//console.log(sim.time(),pop,start,stop)

 			if (sim.time()<stop){
 					this.setTimer(random.normal(30/pop,1)).done(function(){//set time to next vehicle...can be more complex
		        			sim.addEntity(Vehicle);
		        			this.vehArrival(pop,start,stop);
		        	});
			}
 		},
		startDatetime:0,
 		start:function(){

			 				//set start date
							 this.startDatetime=new Date(2017,4,1,0,0,0)

 							if(system.control.discharge){this.setDischargeEvents()};//set up discharge requests.
 						//console.log("controller started");
 							this.Constraints = {exportCap:system.control.export_cap,importCap:system.control.import_cap}
 							this.askStatus();//set data logging going
 				
 							this.discharge();//set discharge going
 							this.periodTick();//set half houly update going

 							//this.askCommand();
 							//fire random events fro discharging and charging...... including how long for...
 							//this.sendTick();
 							//add solar unit
 							//add 
 						},
 		setDischargeEvents:function(){
 			this.dischargeEvents.push({type:"Discharge",start:50,stop:80,capacity:20})
 			this.dischargeEvents.push({type:"Discharge",start:90,stop:200,capacity:100})
 			this.dischargeEvents.push({type:"Discharge",start:480,stop:550,capacity:100})
 		},
 		discharge:function(){
 			//function needs to have array of discharge events
 			//loop through events and discharge as required...
 			disTrigger=false;
 			disCap=0;
 			 for(i=0;i<this.dischargeEvents.length;i++){
 				 	 	d=this.dischargeEvents[i]
 				 	
	 			 	if (sim.time()>d.start && sim.time()<d.stop){
		 			 	disTrigger=true;
		 			 	disCap=disCap<d.capacity?disCap:d.capacity;
	 			 	}
 			 }
 			if (disTrigger){
 				this.send({c:"discharge",data:this.vehStatus,capacity:disCap},0)
 			}
 			else {this.send({c:"hold",data:this.vehStatus},0)}
 			this.setTimer(1).done(function(){this.discharge()})
 			//if export cap then ask for each avialable then  share between 

 		},
 		netformNegotiation:function(){
 			//ask for predicted 
 		},
 		onMessage:function(sender,message){
 			s = sender.id;
 			this.vehStatus.push({s,message})
 			//on
 			//console.log(sender.id,message);
 			//document.getElementById("log").innerHTML += "<pre>"+message.entityId+"</pre>";
 		},
 	}

	sim.addEntity(Controller)
	sim.addEntity(Vehicle);
	sim.simulate(SIMTIME);
	//system.tempsolar=Park.solarGeneration.profile.May
	//console.log(Park.solarGeneration.periodOutput("May",10))
	console.log("Simulation End")
	//console.log(sim)
	system.simtime=SIMTIME
	system.events=Controller.dischargeEvents
	sim.finalize()
	//console.log(Controller.log)
	$("#controlpanel").show()
	$(".controls").show()
	//stats_vehicles.finalize(sim.time())
	//visualise(log);
	//console.log(stats_vehicles.getHistogram())      // start simulation
   // Park.report();  
}
