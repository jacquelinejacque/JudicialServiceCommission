
<script>
import DataTable from 'datatables.net-vue3'
import { Const } from '../../utils/constants'
import DataTableBs5 from 'datatables.net-bs5'
import ApproveGuest from './ApproveGuest.vue'
import PreRegisterForm from './PreRegisterForm.vue'
import Toastify from 'toastify-js'
import axios from 'axios'
import { Modal } from 'bootstrap'
import CheckOut from './CheckOut.vue'
DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable,
    PreRegisterForm,
    ApproveGuest,
    CheckOut,
  },

  data() {
    return {
      currentUser: JSON.parse(localStorage.getItem('user') || '{}'),
      selectedguestId: null,
      selectedGuest: null,
      actionModal: null,
      selectedAction: null,
      passNumberSearchTimeout: null,
      idNumberSearchTimeout: null,
      legalTeamUsers: [],
      exportingReports: false,
      selectedApprovalVisitID: null,
      selectedCheckOutVisitID: null,
      approvalModal: null,
      filters: {
        idNumber: '',
        passNumber: '',
        source: '',
        status: '',
        visitCategory: '',
        fileNumber: '',
        department: '',
        assignedTo: '',
        dateRange: '',
        startDate: '',
        endDate: ''
      },
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
        order: [["receivedDate", 'DESC']],
        ajax: {
          url: `${Const.BASE_URL}/guestsVisits/list`,
          type: 'get',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          },
          data: (d) => {
            d.department = this.filters.department
            d.visitCategory = this.filters.visitCategory
            d.idNumber = this.filters.idNumber
            d.status = this.filters.status
            d.passNumber = this.filters.passNumber
            d.assignedTo = this.filters.assignedTo
            d.dateRange = this.filters.dateRange
            d.startDate = this.filters.startDate
            d.endDate = this.filters.endDate

          },
          error: function () {
            console.log('Error loading data')
          }
        }
      },
        columns: [
        { title: 'PassNumber', data: 'passNumber' },
        { title: 'Guest Name', data: 'guestName' },
        { title: 'Reception Desk', data: 'receptionDeskName' },
        { title: 'Id Type', data: 'idType' },
        { title: 'ID Number', data: 'idNumber' },
        { title: 'Organization', data: 'organization' },
        { title: 'Visit Purpose', data: 'purpose' },
        { title: 'Department of Visit', data: 'department' },
        { title: 'Visit Category', data: 'visitCategory' },
        { title: 'Visit Duration', data: 'timeIn' },
        { title: 'Check-In Time', data: 'checkInTime', render: (data) => this.formatDate(data)  },
        { title: 'Check-Out Time', data: 'checkOutTime', render: (data) => this.formatDate(data)  },
        { title: 'Status', data: 'status' },
        { title: 'Action', data: null, render: '#action' }
        ]
    }
  },

  mounted() {
    console.log('Current user from localStorage:', this.currentUser)
    console.log('Is registrar:', this.isRegistrar)
    this.dt = this.$refs.table.dt
    
  },
  computed: {
    formattedAction() {
      return this.selectedAction
        ? this.selectedAction.replaceAll('_', ' ')
        : ''
    },
    permissions() {
      return this.currentUser?.permissions || []
    },

    isAdmin() {
      return this.permissions.includes('admin.access') // optional if you have it
    },

    isNormalUser() {
      return this.permissions.length > 0
    },

    isReceptionist() {
      return this.permissions.includes('guest.checkin')
    },

    canApproveGuest() {
      return this.permissions.includes('guest.approval')
    },

    canCheckOutGuest() {
      return this.permissions.includes('guest.checkout')
    }
  },
  methods: {
    can(permission) {
      return this.permissions.includes(permission)
    },

    openCheckOutModal(record) {
      this.selectedCheckOutVisitID = record.visitID

      const modalEl = document.getElementById('checkOutModal')
      const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
      modal.show()
    },

    handleCheckOutCompleted() {
      const modalEl = document.getElementById('checkOutModal')
      const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
      modal.hide()

      modalEl.addEventListener(
        'hidden.bs.modal',
        () => {
          document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
          document.body.classList.remove('modal-open')
          document.body.style.removeProperty('padding-right')
        },
        { once: true }
      )

      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false)
      }
    },
    openApproveGuestModal(record) {
      this.selectedApprovalVisitID = record.visitID

      const modalEl = document.getElementById('approveGuestModal')
      const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
      modal.show()
    },

    handleApprovalCompleted() {
      const modalEl = document.getElementById('approveGuestModal')
      const modal = Modal.getInstance(modalEl) || new Modal(modalEl)
      modal.hide()

      modalEl.addEventListener(
        'hidden.bs.modal',
        () => {
          document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
          document.body.classList.remove('modal-open')
          document.body.style.removeProperty('padding-right')
        },
        { once: true }
      )

      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false)
      }
    },
    applyFilters() {
      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, true)
      }
    },
    handleDateRangeChange() {
      // Reset custom dates when switching presets
      if (this.filters.dateRange !== 'custom') {
        this.filters.startDate = ''
        this.filters.endDate = ''
      }

      this.applyFilters()
    },
    handlePassNumberSearch() {
      clearTimeout(this.passNumberSearchTimeout)

      this.passNumberSearchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 400)
    },
    handleIdNumberSearch() {
      clearTimeout(this.idNumberSearchTimeout)

      this.idNumberSearchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 400)
    },
    handleFileNumberSearch() {
      clearTimeout(this.fileNumberSearchTimeout)

      this.fileNumberSearchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 400)
    },
    clearFilters() {
      this.filters = {
        stage: '',
        title: '',
        source: '',
        status: '',
        fileNumber: '',
        visitCategory: '',
        department: '',
        assignedTo: '',
        dateRange: '',
        startDate: '',
        endDate: ''
      }

      this.applyFilters()
    },

    formatDate(dateString) {
      if (!dateString) return ''

      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()

      return `${day}/${month}/${year}`
    },
    openCheckInModal(record) {
      this.selectedGuest = { ...record }

      const modal = new Modal(document.getElementById('checkInModal'))
      modal.show()
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
      this.selectedRecord = {
        ...record,
        recordID: record.recordID || record.recordId
      }
      console.log(this.selectedRecord)
    },

    setRecordId(recordId) {
      this.selectedRecordId = recordId
      console.log('Selected record Id:', this.selectedRecordId)
    },
    handleGuestSaved(mode) {
      const modalId =
        mode === 'walkIn'
          ? 'walkInGuestModal'
          : mode === 'checkInPreRegistered'
            ? 'checkInModal'
            : 'preRegisterModal'

      const modalEl = document.getElementById(modalId)

      if (modalEl) {
        const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl)
        modalInstance.hide()

        modalEl.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
            document.body.classList.remove('modal-open')
            document.body.style.removeProperty('padding-right')
          },
          { once: true }
        )
      }

      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false)
      }
    },
    viewRecord(record) {
      this.$router.push({
        name: 'GuestView',
        params: { visitID: record.visitID }
      })
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
      this.selectedRecord = { ...record }
      this.selectedRecordId = record.recordID
      this.selectedAction = action
      console.log("FULL RECORD:", record)
      // reset payload
      this.actionPayload = {
        hearingDate: '',
        judgement: ''
      }

      const modal = new Modal(document.getElementById('actionModal'))
      modal.show()
    },

    handleActionCompleted() {
      const modalEl = document.getElementById('actionModal')
      const modal = Modal.getInstance(modalEl)
      modal.hide()

      this.getRecords()
    }
  },
  props: []
}
</script>

<template>
  <div class="container-fluid px-3 py-4">

    <!-- Card -->
    <div class="card shadow-sm">

      <!-- Card header -->
      <div class="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div class="d-flex flex-column">
          <h5 class="card-title mb-1">Judicial Service Commission Guest Record</h5>
          <small class="text-muted">Manage Guest Visits, roles and status</small>
        </div>

        <div class="d-flex gap-2">
          <button  v-if="can('guest.preregister')" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#preRegisterModal">
            PreRegister Guest
          </button>

          <button v-if="can('guest.addwalkin')" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#walkInGuestModal">
            Add Walk-In Guest
          </button>
        </div>
      </div>
      <div class="card-body border-bottom bg-light">
        <div class="row g-3 align-items-end">

          <div class="col-md-2">
            <label for="filterDateRange" class="form-label">Date Range</label>
            <select
              id="filterDateRange"
              v-model="filters.dateRange"
              class="form-select"
              @change="handleDateRangeChange"
            >
              <option value="">All Dates</option>
              <option value="1_month">Last 30 Days</option>
              <option value="3_months">Last 90 Days</option>
              <option value="6_months">Last 180 Days</option>
              <option value="12_months">Last 360 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div v-if="filters.dateRange === 'custom'" class="col-md-2">
            <label for="filterStartDate" class="form-label">Start Date</label>
            <input
              id="filterStartDate"
              v-model="filters.startDate"
              type="date"
              class="form-control"
              @change="applyFilters"
            />
          </div>

          <div v-if="filters.dateRange === 'custom'" class="col-md-2">
            <label for="filterEndDate" class="form-label">End Date</label>
            <input
              id="filterEndDate"
              v-model="filters.endDate"
              type="date"
              class="form-control"
              @change="applyFilters"
            />
          </div>

          <div class="col-md-2">
            <label for="filterIdNumber" class="form-label">ID Number</label>
            <input
              id="filterIdNumber"
              v-model="filters.idNumber"
              type="text"
              class="form-control"
              placeholder="Search by ID Number"
              @input="handleIdNumberSearch"
            />
          </div>

          <div class="col-md-2">
            <label for="filterFileNumber" class="form-label">File Number</label>
            <input
              id="filterFileNumber"
              v-model="filters.fileNumber"
              type="text"
              class="form-control"
              placeholder="Filter by File Number"
              @input="handleFileNumberSearch"
            />
          </div>

          <div class="col-md-2">
            <label for="filterPassNumber" class="form-label">Pass Number</label>
            <input
              id="filterPassNumber"
              v-model="filters.passNumber"
              type="text"
              class="form-control"
              placeholder="Search by passNumber"
              @input="handlePassNumberSearch"
            />
          </div>

          <div class="col-md-2">
            <label for="filterVisitCategory" class="form-label">Visit Category</label>
            <select
              id="filterVisitCategory"
              v-model="filters.visitCategory"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Categories</option>
              <option value="officialMeeting">Official Meeting</option>
              <option value="vendor">Vendor</option>
              <option value="interview">Interview</option>
              <option value="contractor">Contractor</option>
              <option value="delivery">Delivery</option>
              <option value="walkIn">WalkIn</option>
              <option value="personalVisit">Personal Visit</option>
            </select>
          </div>

          <div class="col-md-2">
            <label for="filterDepartment" class="form-label">Department</label>
            <select
              id="filterDepartment"
              v-model="filters.department"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Departments</option>
              <option value="administration">Administration</option>
              <option value="officeOfRegistrar">Office Of Registrar</option>
              <option value="legal">Legal</option>
              <option value="complaints">Complaints</option>
              <option value="communication">Communication</option>
              <option value="HR">Human Resource</option>
              <option value="accounts">Accounts</option>
              <option value="finance">Finance</option>
              <option value="procurement">Procurement</option>
              <option value="supplyChain">Supply Chain</option>
              <option value="inspectorate">Inspectorate</option>
              <option value="ICT">ICT</option>
              <option value="records">Records</option>
            </select>
          </div>

          <div class="col-md-2">
            <label for="filterStatus" class="form-label">Status</label>
            <select
              id="filterStatus"
              v-model="filters.status"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Statuses</option>
              <option value="preRegistered">Pre Registered</option>
              <option value="pendingApproval">Pending Approval</option>
              <option value="approved">Approved</option>                         
              <option value="rejected">Rejected</option>
              <option value="checkedIn">Checked In</option>
              <option value="overdue">Overdue</option>
              <option value="checkedOut">Checked Out</option>
              <option value="denied">Denied</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div class="col-md-2">
            <label class="form-label d-block">&nbsp;</label>
            <div class="d-flex gap-2">
              <button
                class="btn btn-success btn-sm"
                @click="exportReports"
                :disabled="exportingReports"
              >
                <span v-if="exportingReports">Exporting...</span>
                <span v-else>Export Reports</span>
              </button>

              <button
                class="btn btn-outline-secondary btn-sm"
                @click="clearFilters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
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
              <li>
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="viewRecord(props.rowData)"
                >
                  View
                </a>
              </li>

              <li v-if="permissions.includes('guest.checkin') && props.rowData.status === 'preRegistered'">
                <a
                  href="#"
                  class="dropdown-item text-success"
                  @click.prevent="openCheckInModal(props.rowData)"
                >
                  Check-In Guest
                </a>
              </li>
              <li
                v-if="permissions.includes('guest.approval') && ['rejected', 'pendingApproval'].includes(props.rowData.status)"
              >
                <a
                  href="#"
                  class="dropdown-item text-success"
                  @click.prevent="openApproveGuestModal(props.rowData)"
                >
                  Give Approval
                </a>
              </li>

              <li
                v-if="canCheckOutGuest && ['checkedIn', 'overdue'].includes(props.rowData.status)"
              >
                <a
                  href="#"
                  class="dropdown-item text-danger"
                  @click.prevent="openCheckOutModal(props.rowData)"
                >
                  Check Out Guest
                </a>
              </li>
              <!-- Edit -->
              <li v-if="props.rowData.status === 'Received'" >
                <a  
                  href="#"
                  class="dropdown-item"
                  data-bs-toggle="modal"
                  data-bs-target="#editRecordModal"
                  @click.prevent="editRecord(props.rowData)"
                >
                  Edit
                </a>
              </li>

            </ul>
            </div>
          </template>            
          </DataTable>
        </div>
      </div>

    </div>

    <!-- Pre register guest modal -->
    <div
      class="modal modal-blur fade"
      id="preRegisterModal"
      tabindex="-1"
      aria-labelledby="preRegisterModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm mode="preRegister" @guest-saved="handleGuestSaved" />
      </div>
    </div>

        <!-- WalkIn Guest modal -->
    <div class="modal modal-blur fade" id="walkInGuestModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm mode="walkIn" @guest-saved="handleGuestSaved" />
      </div>
    </div>

     <!-- CheckIn Pre Registered Guest modal -->
    <div class="modal modal-blur fade" id="checkInModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm
          mode="checkInPreRegistered"
          :prefillData="selectedGuest"
          @guest-saved="handleGuestSaved"
        />
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

    <div class="modal modal-blur fade" id="approveGuestModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <ApproveGuest
          v-if="selectedApprovalVisitID"
          :visitID="selectedApprovalVisitID"
          @approval-completed="handleApprovalCompleted"
        />
      </div>
    </div>

    <div class="modal modal-blur fade" id="checkOutModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <CheckOut
          v-if="selectedCheckOutVisitID"
          :visitID="selectedCheckOutVisitID"
          @checkout-completed="handleCheckOutCompleted"
        />
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