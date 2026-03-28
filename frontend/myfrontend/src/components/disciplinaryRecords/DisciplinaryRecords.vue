
<script>
import DataTable from 'datatables.net-vue3'
import { Const } from '../../utils/constants'
import DataTableBs5 from 'datatables.net-bs5'
import EditRecordForm from './EditRecordForm.vue'
import AddRecordForm from './AddRecordForm.vue'
import Toastify from 'toastify-js'
import axios from 'axios'
import { Modal } from 'bootstrap'
DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable,
    AddRecordForm,
    EditRecordForm,
  },

  data() {
    return {
      selectedRecordId: null,
      selectedRecord: null,
      deleteFeedback: '',
      restoreFeedback: '',
      actionModal: null,
      selectedAction: null,
      actionPayload: {
        hearingDate: '',
        judgement: '',
        reason: '',
        note: ''
      },
        options: {
        responsive: true,
        serverSide: false,
        processing: true,
        select: true,
        bLengthChange: false,
        bInfo: false,
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        loading: false,
        order: [[6, 'asc']],
        ajax: {
          url: `${Const.BASE_URL}/disciplinaryRecords/list`,
          type: 'get',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          },
          error: function () {
            console.log('Error loading data')
          }
        }
      },
        columns: [
        { title: 'PJ Number', data: 'pjNumber' },
        { title: 'Officer Name', data: 'officerName' },
        { title: 'File Number', data: 'fileNumber' },
        { title: 'Designation', data: 'designation' },
        { title: 'Nature Of Charges', data: 'natureOfCharges' },
        { title: 'Date Escalated', data: 'dateEscalated', render: (data) => (data ? new Date(data).toLocaleDateString() : '_')  },
        { title: 'Date Filed', data: 'dateFiled', render: (data) => (data ? new Date(data).toLocaleDateString() : '_') },
        { title: 'Panel', data: 'panel' },
        { title: 'Assigned To', data: 'assignedTo' },
        { title: 'Judgement', data: 'judgement' },
        { title: 'Status', data: 'status' },
        { title: 'Action', data: null, render: '#action' }
        ]
    }
  },

  mounted() {
    this.dt = this.$refs.table.dt
  },
  computed: {
    formattedAction() {
      return this.selectedAction
        ? this.selectedAction.replaceAll('_', ' ')
        : ''
    }
  },
  methods: {
    async getRecords() {
      this.dt = this.$refs.table.dt
      this.dt.ajax.reload(null, false)
    },

    showToast(message, isDanger) {
      Toastify({
        text: message,
        // className: className,
        style: {
          background: isDanger ? '#d63939' : '#2fb344'
        }
      }).showToast()
    },
    editRecord(record) {
      this.selectedRecord = { ...record }
      console.log(this.selectedRecord)
    },

    setRecordId(recordId) {
      this.selectedRecordId = recordId
      console.log('Selected record Id:', this.selectedRecordId)
    },

    handleRecord() {
      //console.log('Record added, closing modal and refreshing data...');
      const modal = document.getElementById('addRecordModal');
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal);
        modalInstance.hide();
        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
            document.body.classList.remove('modal-open'); 
          },
          { once: true }
        );
      }
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false);
      } else {
        console.error('DataTable reference is missing.');
      }
    },

    async deleteRecord() {
      this.loading = true
      if (!this.selectedRecordId) {
        this.showToast('Record ID is missing', true)
        this.loading = false
        return
      }
      try {
        const res = await axios.post(
          `${Const.BASE_URL}/users/delete`,
          { userId: this.selectedUserId,
            feedback: this.deleteFeedback
           },
          { headers: { 'access-token': localStorage.getItem('accessToken') } }
        )
        console.log(res.data)
        this.loading = false
        if (res.data.status === 200) {
          this.showToast('User successfully deleted', false)
          const modal = document.getElementById('deleteUserModal')
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
          this.getUsers()
        } else {
          const message = res.data.message || 'oops, something went wrong!'
          this.showToast(message, true)
        }
      } catch (error) {
        console.error('Error deleting the user:', error)
        this.showToast('Failed to delete user, please try again', true)
      } finally {
        this.loading = false
      }
    },

    handleRecordEditing() {
      //console.log('Record added, closing modal and refreshing data...');
      const modal = document.getElementById('editRecordModal');
      if (modal) {
        const modalInstance = Modal.getInstance(modal) || new Modal(modal);
        modalInstance.hide();
        modal.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
            document.body.classList.remove('modal-open'); 
          },
          { once: true }
        );
      }
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false);
      } else {
        console.error('DataTable reference is missing.');
      }
    },
  
    openActionModal(record, action) {
      this.selectedRecord = record
      this.selectedRecordId = record.recordID
      this.selectedAction = action

      // reset payload
      this.actionPayload = {
        hearingDate: '',
        judgement: ''
      }

      const modal = new Modal(document.getElementById('actionModal'))
      modal.show()
    },
    async submitAction() {
      try {
        let payloadToSend = {}

        // Only send payload when needed
        if (this.selectedAction === 'ADD_HEARING_DATE') {
          payloadToSend.hearingDate = this.actionPayload.hearingDate
        }
        if (this.selectedAction === 'ADJOURN_CASE') {
          payloadToSend.reason = this.actionPayload.reason
        }
        if (this.selectedAction === 'JUDGMENT_RESERVED') {
          payloadToSend.note = this.actionPayload.note
        }       
        if (this.selectedAction === 'ADD_JUDGEMENT') {
          payloadToSend.judgement = this.actionPayload.judgement
        }

        const res = await axios.post(
          `${Const.BASE_URL}/disciplinaryRecords/update-action`,
          {
            recordID: this.selectedRecordId,
            action: this.selectedAction,
            payload: payloadToSend
          },
          {
            headers: {
              'access-token': localStorage.getItem('accessToken')
            }
          }
        )

        if (res.data.status === 200) {
          this.showToast("Action successful", false)

          const modalEl = document.getElementById('actionModal')
          const modal = Modal.getInstance(modalEl)
          modal.hide()

          this.getRecords()
        } else {
          this.showToast(res.data.message, true)
        }
      } catch (err) {
        console.error(err)
        this.showToast("Action failed", true)
      }
    }  
  },
  props: []
}
</script>

<template>
  <div class="container-xxl py-4">

    <!-- Card -->
    <div class="card shadow-sm">

      <!-- Card header -->
      <div class="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div class="d-flex flex-column">
          <h5 class="card-title mb-1">Disciplinary Records</h5>
          <small class="text-muted">Manage Records, roles and status</small>
        </div>

        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addRecordModal">
          Add Record
        </button>
      </div>

      <!-- Card body -->
      <div class="card-body p-3">
        <div class="table-responsive">
          <DataTable
            ref="table"
            :columns="columns"
            :options="options"
            width="100%"
            class="table table-hover table-striped table-sm mb-0"
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

              <!-- Edit -->
              <li>
                <a
                  href="#"
                  class="dropdown-item text-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#editRecordModal"
                  @click.prevent="editRecord(props.rowData)"
                >
                  Edit
                </a>
              </li>

              <!-- Add Hearing Date -->
              <li v-if="props.rowData.status === 'Filed' || props.rowData.status === 'Adjourned' ">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'ADD_HEARING_DATE')"
                >
                  Add Hearing Date
                </a>
              </li>

              <!-- Hearing Actions -->
              <li v-if="props.rowData.status === 'Hearing'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'ADJOURN_CASE')"
                >
                  Adjourn Case
                </a>
              </li>

              <li v-if="props.rowData.status === 'Hearing'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'JUDGMENT_RESERVED')"
                >
                  Reserve Judgement
                </a>
              </li>

              <li v-if="props.rowData.status === 'Hearing' || props.rowData.status === 'Judgment Reserved'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'ADD_JUDGEMENT')"
                >
                  Deliver Judgement
                </a>
              </li>

              <!-- Close Case -->
              <li v-if="props.rowData.status === 'Judgment Delivered'">
                <a
                  href="#"
                  class="dropdown-item text-danger"
                  @click.prevent="openActionModal(props.rowData, 'CLOSE_CASE')"
                >
                  Close Case
                </a>
              </li>

            </ul>
            </div>
          </template>            
          </DataTable>
        </div>
      </div>

    </div>

    <!-- Add record modal -->
    <div
      class="modal modal-blur fade"
      id="addRecordModal"
      tabindex="-1"
      aria-labelledby="addRecordModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <AddRecordForm @record-Added="handleRecord" />
      </div>
    </div>

    <!-- Edit Record modal -->
    <div
      class="modal fade"
      id="editRecordModal"
      tabindex="-1"
      aria-labelledby="editRecord"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <EditRecordForm v-if="selectedRecord" :record="selectedRecord" @record-Edited="handleRecordEditing" />
      </div>
    </div>

  <div class="modal fade" id="actionModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title">
            {{ formattedAction }}
          </h5>
          <button class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <div class="modal-body">

          <!-- Hearing Date -->
          <div v-if="selectedAction === 'ADD_HEARING_DATE'">
            <label class="form-label">Hearing Date</label>
            <input
              type="datetime-local"
              class="form-control"
              v-model="actionPayload.hearingDate"
            />
          </div>

          <!-- Adjourn -->
          <div v-if="selectedAction === 'ADJOURN_CASE'">
            <p>Are you sure you want to adjourn this case?</p>
            <input
              type="text"
              class="form-control"
              v-model="actionPayload.reason"
            />
          </div>

          <!-- Reserve Judgement -->
          <div v-if="selectedAction === 'JUDGMENT_RESERVED'">
            <p>Judgement will be reserved. No decision will be recorded now.</p>
            <input
              type="textarea"
              class="form-control"
              v-model="actionPayload.note"
            />
          </div>

          <!-- Judgement -->
          <div v-if="selectedAction === 'ADD_JUDGEMENT'">
            <label class="form-label">Judgement</label>
            <textarea
              class="form-control"
              rows="3"
              v-model="actionPayload.judgement"
            ></textarea>
          </div>

          <!-- Close Case -->
          <div v-if="selectedAction === 'CLOSE_CASE'">
            <p>Are you sure you want to close this case?</p>
          </div>

        </div>

        <div class="modal-footer">
          <button class="btn" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" @click="submitAction">
            Submit
          </button>
        </div>

      </div>
    </div>
  </div>

  </div>
</template>

<style>
.button-container {
  display: flex;
  flex-direction: row;
  gap: 2em;
}
</style>