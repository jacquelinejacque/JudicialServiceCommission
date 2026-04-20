<script>
import DataTable from 'datatables.net-vue3'
import DataTableBs5 from 'datatables.net-bs5'
import { Const } from '../../utils/constants'
import RaiseTicketForm from './RaiseTicketForm.vue'
import Toastify from 'toastify-js'
import { Modal, Dropdown } from 'bootstrap'
import AssignTicketForm from './AssignTicketForm.vue'

DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable,
    RaiseTicketForm,
    AssignTicketForm
  },

  data() {
    return {
      selectedTicket: null,
      loading: false,
      currentUser: JSON.parse(localStorage.getItem('user') || '{}'),      
      reassignMode: false,      
      actionMode: 'assign',

      options: {
        responsive: true,
        serverSide: false,
        processing: true,
        select: true,
        bLengthChange: false,
        bInfo: true,
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        ajax: {
          url: `${Const.BASE_URL}/helpDesk/list`,
          type: 'GET',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          },
          dataSrc: function (json) {
            console.log('HelpDesk list response:', json)
            return json?.tickets || []
          },
          error: function (xhr) {
            console.log('Error loading tickets:', xhr?.responseText || xhr)
          }
        }
      },

      columns: [
        {
          title: 'Ticket No',
          data: 'ticketNumber',
          defaultContent: '_'
        },
        {
          title: 'Requester',
          data: null,
          render: (data, type, row) => row.requester?.name || row.createdBy || '_'
        },
        {
          title: 'Email',
          data: null,
          render: (data, type, row) => row.requester?.email || '_'
        },
        {
          title: 'Phone',
          data: null,
          render: (data, type, row) => row.requester?.phone || '_'
        },
        {
          title: 'Issue Type',
          data: 'issueType',
          defaultContent: '_'
        },
        {
          title: 'Title',
          data: 'title',
          defaultContent: '_'
        },
        {
          title: 'Priority',
          data: 'priority',
          defaultContent: '_'
        },
        {
          title: 'Status',
          data: 'status',
          defaultContent: '_'
        },
        {
          title: 'Assigned To',
          data: null,
          render: (data, type, row) => row.agent?.name || '_'
        },
        {
          title: 'Created At',
          data: 'createdAt',
          render: (data) => {
            return data ? new Date(data).toLocaleString() : '_'
          }
        },
        {
          title: 'Action',
          data: null,
          render: '#action',
          orderable: false
        }
      ]
    }
  },

  computed: {
    isAdmin() {
      return this.currentUser?.role === 'admin'
    },
    isAgent() {
      return this.currentUser?.role === 'agent'
    },
    isNormalUser() {
      return this.currentUser?.role === 'normalUser'
    }
  },

  mounted() {
    this.dt = this.$refs.table.dt

    this.$nextTick(() => {
      this.initDropdowns()
    })

    if (this.$refs.table?.dt) {
      this.$refs.table.dt.on('draw', () => {
        this.$nextTick(() => {
          this.initDropdowns()
        })
      })
    }
  },

  methods: {
    isAssignedAgent(ticket) {
      return this.isAgent && ticket?.assignedTo === this.currentUser?.userID
    },

    isNewTicket(ticket) {
      return ticket?.status === 'new'
    },

    isOpenTicket(ticket) {
      return ticket?.status === 'open'
    },

    isResolvedTicket(ticket) {
      return ticket?.status === 'resolved'
    },

    canViewTicket() {
      return true
    },

    canAssignTicket(ticket) {
      return this.isAdmin && this.isNewTicket(ticket)
    },

    canReassignTicket(ticket) {
      return this.isAdmin && this.isOpenTicket(ticket)
    },

    canEscalateTicket(ticket) {
      return this.isAdmin && this.isOpenTicket(ticket)
    },

    canAddNotes(ticket) {
      return (this.isAdmin || this.isAssignedAgent(ticket)) && this.isOpenTicket(ticket)
    },

    canResolveTicket(ticket) {
      return (this.isAdmin || this.isAssignedAgent(ticket)) && this.isOpenTicket(ticket)
    },

    canCloseTicket(ticket) {
      return this.isAdmin && this.isResolvedTicket(ticket)
    }, 

    reloadTickets() {
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false)
      } else {
        console.error('DataTable reference is missing.')
      }
    },

    showToast(message, isDanger = false) {
      Toastify({
        text: message,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },

    handleTicket(payload) {
      const modal = document.getElementById('raiseTicketModal')
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal)
        modalInstance.hide()

        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
            document.body.classList.remove('modal-open')
          },
          { once: true }
        )
      }

      this.reloadTickets()
      this.showToast(payload?.message || 'Ticket raised successfully')
    },

    initDropdowns() {
      document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach((el) => {
        if (!el._dropdownInstance) {
          el._dropdownInstance = new Dropdown(el)
        }
      })
    },
    assignTicket(ticket) {
      this.openActionModal(ticket, 'assign')
    },

    reassignTicket(ticket) {
      this.openActionModal(ticket, 'reassign')
    },

    escalateTicket(ticket) {
      this.openActionModal(ticket, 'escalate')
    },

    addNotes(ticket) {
      this.openActionModal(ticket, 'notes')
    },

    resolveTicket(ticket) {
      this.openActionModal(ticket, 'resolve')
    },

    closeTicket(ticket) {
      this.openActionModal(ticket, 'close')
    },
    viewTicket(ticket) {
      this.$router.push({
        name: 'ict-help-desk-view',
        params: { ticketID: ticket.ticketID }
      })
    },

    showAssignModal() {
      this.$nextTick(() => {
        const modalEl = document.getElementById('assignTicketModal')
        if (modalEl) {
          const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl)
          modalInstance.show()
        }
      })
    },

    handleTicketAssigning() {
      const modal = document.getElementById('assignTicketModal')
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal)
        modalInstance.hide()
        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove())
            document.body.classList.remove('modal-open')
          },
          { once: true }
        )
      }

      this.selectedTicket = null
      this.reassignMode = false
      this.reloadTickets()
      this.showToast(this.reassignMode ? 'Ticket reassigned successfully' : 'Ticket assigned successfully')
    },
 
    openActionModal(ticket, mode) {
      this.selectedTicket = ticket
      this.reassignMode = false
      this.actionMode = mode
      this.showAssignModal()
    }
  },

  props: []
}
</script>

<template>
  <div class="container-xxl py-3">
    <div class="card shadow-sm">
      <div class="card-header d-flex align-items-center justify-content-between">
        <div>
          <h5 class="card-title mb-0">ICT Help Desk Requests</h5>
          <small class="text-muted">
            Admins see all tickets. Other users see tickets they created or tickets assigned to them.
          </small>
        </div>

        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#raiseTicketModal">
          Raise Ticket
        </button>
      </div>

      <div class="card-body p-0 overflow-visible">
        <div class="table-responsive overflow-visible">
          <DataTable
            ref="table"
            :columns="columns"
            :options="options"
            width="100%"
            class="table table-hover table-striped mb-0"
          >
          <template #action="props">
            <div class="dropdown position-relative">
              <button
                class="btn btn-sm btn-outline-primary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Actions
              </button>

              <ul class="dropdown-menu dropdown-menu-end shadow">
                <li v-if="canViewTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="viewTicket(props.rowData)"
                  >
                    View Ticket
                  </a>
                </li>

                <li v-if="canAssignTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="assignTicket(props.rowData)"
                  >
                    Assign Ticket
                  </a>
                </li>

                <li v-if="canReassignTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="reassignTicket(props.rowData)"
                  >
                    Reassign Ticket
                  </a>
                </li>

                <li v-if="canEscalateTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="escalateTicket(props.rowData)"
                  >
                    Escalate Ticket
                  </a>
                </li>

                <li v-if="canAddNotes(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="addNotes(props.rowData)"
                  >
                    Add Notes
                  </a>
                </li>

                <li v-if="canResolveTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="resolveTicket(props.rowData)"
                  >
                    Resolve Ticket
                  </a>
                </li>

                <li v-if="canCloseTicket(props.rowData)">
                  <a
                    class="dropdown-item"
                    href="#"
                    @click.prevent="closeTicket(props.rowData)"
                  >
                    Close Ticket
                  </a>
                </li>
              </ul>
            </div>
          </template>
          </DataTable>
        </div>
      </div>
    </div>

    <div
      class="modal modal-blur fade"
      id="raiseTicketModal"
      tabindex="-1"
      aria-labelledby="raiseTicketModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <RaiseTicketForm @ticket-raised="handleTicket" />
      </div>
    </div>
  </div>

      <!-- Assign Ticket modal -->
      <div
        class="modal fade"
        id="assignTicketModal"
        tabindex="-1"
        aria-labelledby="assignTicket"
        aria-hidden="true"
      >
        <div class="modal-dialog modal-dialog-centered">
          <AssignTicketForm
            v-if="selectedTicket"
            :ticket="selectedTicket"
            :mode="actionMode"
            @ticket-Assigned="handleTicketAssigning"
          />       
        </div>
      </div>
   

</template>