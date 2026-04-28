// import PaymentList from '@/components/payment/PaymentList.vue'
import Login from '../components/users/Login.vue' 
import MainComponent from '@/components/MainComponent.vue' 
// import Dashboard from '@/components/dashboard/Dashboard.vue'
// import InvoiceList from '@/components/invoice/InvoiceList.vue'
// import NewInvoice from '@/components/invoice/NewInvoice.vue'
import IctHelpDesk from '@/components/ict/IctHelpDesk.vue'
import ViewTicket from '@/components/ict/ViewTicket.vue'
import Users from '@/components/users/Users.vue'
import DisciplinaryRecords from '@/components/disciplinaryRecords/DisciplinaryRecords.vue'
import DisciplinaryRecordsDetails from '@/components/disciplinaryRecords/DisciplinaryRecordsDetails.vue'
import GuestsManagement from '@/components/guests/GuestsManagement.vue'

export const routes = [
  {
    path: '/',
    name: 'index',
    component: Login,
    meta: {
      public: true
    }
  },
  {
    path: '/records',
    name: 'Main',
    component: MainComponent,
    meta: {
      requiresAuth: true
    },
    children: [
    //   {
    //     path: 'records/dashboard',
    //     name: 'dashboard',
    //     component: Dashboard,
    //     meta: {
    //       requiresAuth: true
    //     }
    //   },
      {
        path: 'users/list-users',
        name: 'system-users',
        component: Users,
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'disciplinary-records/list-records',
        name: 'disciplinary-records',
        component: DisciplinaryRecords,
        meta: {
          requiresAuth: true
        }
      },
      {
        path: 'disciplinary-records/:recordID',
        name: 'RecordDetails',
        component: DisciplinaryRecordsDetails,
        props: true
      },
      {
        path: 'ict/help-desk',
        name: 'ict-help-desk',
        component:IctHelpDesk,
        meta: {
          requiresAuth: true
        }
      },  
      {
      path: 'ict/help-desk/:ticketID',
      name: 'ict-help-desk-view',
      component: ViewTicket,
        meta: {
          requiresAuth: true
        }
      }, 
      {
        path: 'guests/guests-management',
        name: 'guests-management',
        component:GuestsManagement,
        meta: {
          requiresAuth: true
        }
      }, 
      
    ]
  },


]