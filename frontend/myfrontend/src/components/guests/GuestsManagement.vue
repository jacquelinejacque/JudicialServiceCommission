
<script>
import DataTable from 'datatables.net-vue3'
import { Const } from '../../utils/constants'
import DataTableBs5 from 'datatables.net-bs5'
//import EditRecordForm from './EditRecordForm.vue'
import PreRegisterForm from './PreRegisterForm.vue'
import Toastify from 'toastify-js'
import axios from 'axios'
import { Modal } from 'bootstrap'
//import RecordActions from './RecordActions.vue'
DataTable.use(DataTableBs5)

export default {
  components: {
    DataTable,
    PreRegisterForm,
//    EditRecordForm,
//    RecordActions,
  },

  data() {
    return {
      currentUser: JSON.parse(localStorage.getItem('user') || '{}'),
      selectedguestId: null,
      selectedGuest: null,
      actionModal: null,
      selectedAction: null,
      titleSearchTimeout: null,
      complainantNameSearchTimeout: null,
      legalTeamUsers: [],
      exportingReports: false,
      filters: {
        stage: '',
        title: '',
        source: '',
        status: '',
        complainantName: '',
        fileNumber: '',
        panel: '',
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
        { title: 'Id Type', data: 'idType' },
        { title: 'ID Number', data: 'idNumber' },
        { title: 'Organization', data: 'organization' },
        { title: 'Visit Purpose', data: 'purpose' },
        { title: 'Department of Visit', data: 'department' },
        { title: 'Visit Category', data: 'visitCategory' },
        { title: 'Visit Duration', data: 'timeIn' },
        { title: 'Check-In Time', data: 'checkInTime', render: (data) => this.formatDate(data)  },
        { title: 'Check-Out Time', data: 'checkOutTime', render: (data) => this.formatDate(data)  },
        { title: 'Action', data: null, render: '#action' }
        ]
    }
  },

  mounted() {
    console.log('Current user from localStorage:', this.currentUser)
    console.log('Is registrar:', this.isRegistrar)
    this.dt = this.$refs.table.dt
    this.fetchLegalTeamUsers()
  },
  computed: {
    formattedAction() {
      return this.selectedAction
        ? this.selectedAction.replaceAll('_', ' ')
        : ''
    },
    isRegistrar() {
      return this.currentUser?.role?.toLowerCase() === 'registrar'
    },
    isDirectorLegal() {
      return this.currentUser?.role?.toLowerCase() === 'directorlegal'
    },
    isLegalTeam() {
      return this.currentUser?.role?.toLowerCase() === 'legalteam'
    }
  },
  methods: {
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
    handleTitleSearch() {
      clearTimeout(this.titleSearchTimeout)

      this.titleSearchTimeout = setTimeout(() => {
        this.applyFilters()
      }, 400)
    },
    handleComplainantNameSearch() {
      clearTimeout(this.complainantNameSearchTimeout)

      this.complainantNameSearchTimeout = setTimeout(() => {
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
        complainantName: '',
        panel: '',
        assignedTo: '',
        dateRange: '',
        startDate: '',
        endDate: ''
      }

      this.applyFilters()
    },
    async fetchLegalTeamUsers() {
      try {
          this.loadingUsers = true

          const res = await axios.get(`${Const.BASE_URL}/users/list`, {
          params: {
              role: 'legalTeam',
          },
          headers: {
              'access-token': localStorage.getItem('accessToken')
          }
          })

          if (res.data?.status === 200) {
          this.legalTeamUsers = res.data.data || []
          } else {
          this.legalTeamUsers = []
          this.showToast(res.data?.message || 'Failed to load legal team users', true)
          }

      } catch (err) {
          console.error(err)
          this.showToast(
          err?.response?.data?.message || 'Failed to fetch legal team users',
          true
          )
          this.legalTeamUsers = []

      } finally {
          this.loadingUsers = false
      }
    },
    async exportReports() {
      try {
        this.exportingReports = true

        const response = await axios.get(`${Const.BASE_URL}/disciplinaryRecords/exportReports`, {
          params: {
            stage: this.filters.stage,
            title: this.filters.title,
            source: this.filters.source,
            status: this.filters.status,
            complainantName: this.filters.complainantName,
            fileNumber: this.filters.fileNumber,
            panel: this.filters.panel,
            assignedTo: this.filters.assignedTo,
            dateRange: this.filters.dateRange,
            startDate: this.filters.startDate,
            endDate: this.filters.endDate
          },
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = 'filtered_reports.xlsx'

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Reports export started", false)
      } catch (error) {
        console.error("Export failed:", error)
        this.showToast("Failed to export reports", true)
      } finally {
        this.exportingReports = false
      }
    },
    formatDate(dateString) {
      if (!dateString) return ''

      const date = new Date(dateString)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()

      return `${day}/${month}/${year}`
    },
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

    handleGuest() {
      const modalEl = document.getElementById('preRegisterModal')

      if (modalEl) {
        const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl)
        modalInstance.hide()

        modalEl.addEventListener(
          'hidden.bs.modal',
          () => {
            document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())
            document.body.classList.remove('modal-open')
          },
          { once: true }
        )
      }

      if (this.$refs.table && this.$refs.table.dt) {
        this.$refs.table.dt.ajax.reload(null, false)
      } else {
        console.error('DataTable reference is missing.')
      }
    },
    viewRecord(record) {
      const recordID = record.recordID || record.recordId

      if (!recordID) {
        this.showToast('Record ID is missing', true)
        return
      }

      this.$router.push({
        name: 'RecordDetails',
        params: { recordID }
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
    async submitAction() {
      try {
        let payloadToSend = {}
        if (this.selectedAction === 'ASSIGN_REPORT') {
          payloadToSend.note = 'Report assigned'
        }

        if (this.selectedAction === 'REGISTER_CASE') {
          payloadToSend.note = 'Case registered'
        }

        if (this.selectedAction === 'PROCESS_CASE') {
          payloadToSend.note = 'Case processing started'
        }

        if (this.selectedAction === 'PRELIMINARY_REVIEW') {
          payloadToSend.note = 'Preliminary review done'
        }

        if (this.selectedAction === 'REVIEW_PRELIMINARY_REPORT') {
          payloadToSend.note = 'Preliminary report reviewed'
        }
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
    }, 
    async downloadReport(record) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/file/${record.recordID}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Report'}_Report`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)

      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download report", true)
      }
    },
    async downloadCaseFile(record, fileType) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/caseFile/${record.recordID}/${fileType}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Case_File'}_${record.fileNumber || 'NoFileNumber'}_${fileType}`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)
      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download file", true)
      }
    },
    async downloadPreliminaryReport(record) {
      try {
        const fileUrl = `${Const.BASE_URL}/disciplinaryRecords/preliminaryReport/${record.recordID}`

        const response = await axios.get(fileUrl, {
          responseType: 'blob',
          headers: {
            'access-token': localStorage.getItem('accessToken')
          }
        })

        const url = window.URL.createObjectURL(response.data)

        let fileName = `${record.title || 'Preliminary_Report'}_PreliminaryReport`

        const disposition = response.headers['content-disposition']
        if (disposition) {
          const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
          const normalMatch =
            disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
            disposition.match(/filename\s*=\s*([^;]+)/i)

          if (utf8Match && utf8Match[1]) {
            fileName = decodeURIComponent(utf8Match[1].trim())
          } else if (normalMatch && normalMatch[1]) {
            fileName = normalMatch[1].trim().replace(/^"|"$/g, '')
          }
        }

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.URL.revokeObjectURL(url)

        this.showToast("Download started", false)
      } catch (error) {
        console.error("Download failed:", error)
        this.showToast("Failed to download preliminary report", true)
      }
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
  <div class="container-xxl py-4">

    <!-- Card -->
    <div class="card shadow-sm">

      <!-- Card header -->
      <div class="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div class="d-flex flex-column">
          <h5 class="card-title mb-1">Judicial Service Commission Guest Record</h5>
          <small class="text-muted">Manage Guest Visits, roles and status</small>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#preRegisterModal">
            PreRegister Guest
          </button>

          <button class="btn btn-success" data-bs-toggle="modal" data-bs-target="#walkInGuestModal">
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
            <label for="filterComplainantName" class="form-label">Complainant Name</label>
            <input
              id="filterComplainantName"
              v-model="filters.complainantName"
              type="text"
              class="form-control"
              placeholder="Search by Complainant Name"
              @input="handleComplainantNameSearch"
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
            <label for="filterStage" class="form-label">Stage</label>
            <select
              id="filterStage"
              v-model="filters.stage"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Stages</option>
              <option value="CASE">CASE</option>
              <option value="REPORT">REPORT</option>
            </select>
          </div>

          <div class="col-md-2">
            <label for="filterTitle" class="form-label">Title</label>
            <input
              id="filterTitle"
              v-model="filters.title"
              type="text"
              class="form-control"
              placeholder="Search by title"
              @input="handleTitleSearch"
            />
          </div>

          <div class="col-md-2">
            <label for="filterSource" class="form-label">Source</label>
            <select
              id="filterSource"
              v-model="filters.source"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Sources</option>
              <option value="OCJ">OCJ</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
          </div>

          <div class="col-md-2">
            <label for="filterPanel" class="form-label">Panel</label>
            <select
              id="filterPanel"
              v-model="filters.panel"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Panels</option>
              <option value="Panel_1">Panel 1</option>
              <option value="Panel_2">Panel 2</option>
              <option value="Panel_3">Panel 3</option>
              <option value="Panel_4">Panel 4</option>
              <option value="Panel_5">Panel 5</option>
              <option value="Panel_6">Panel 6</option>
              <option value="Panel_7">Panel 7</option>
            </select>
          </div>

          <div class="col-md-2">
            <label for="filterAssignedTo" class="form-label">Assigned To</label>
            <select
              id="filterAssignedTo"
              v-model="filters.assignedTo"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">All Legal Team Members</option>
              <option
                v-for="user in legalTeamUsers"
                :key="user.userID"
                :value="user.userID"
              >
                {{ user.name }}
              </option>
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
              <option value="Received">Received</option>
              <option value="Under_review">Under Review</option>
              <option value="Registered">Registered</option>                         
              <option value="Processed">Processed</option>
              <option value="Preliminary_review_completed">Preliminary Review Completed</option>
              <option value="Admitted">Admitted</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Hearing">Hearing</option>
              <option value="Adjourned">Adjourned</option>
              <option value="Judgment Reserved">Judgment Reserved</option>
              <option value="Judgment Delivered">Judgment Delivered</option>
              <option value="Closed">Closed</option>
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
              <li>
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadReport(props.rowData)"
                >
                  Download Report
                </a>
              </li>     
              <li v-if="props.rowData.status === 'Processing'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadCaseFile(props.rowData, 'summary')"
                >
                  Download Summary File
                </a>
              </li>

              <li v-if="props.rowData.status === 'Processing'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadCaseFile(props.rowData, 'boardBrief')"
                >
                  Download Board Brief File
                </a>
              </li>                       
              <li v-if="isRegistrar && props.rowData.status === 'Received'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'ASSIGN_REPORT')"
                >
                  Assign Report
                </a>
              </li>
              <li v-if="isDirectorLegal && props.rowData.status === 'Under_review'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'REGISTER_CASE')"
                >
                  Register Case
                </a>
              </li>
              <li v-if="isLegalTeam 
                        && props.rowData.stage === 'CASE' 
                        && props.rowData.status === 'Registered'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'PROCESS_CASE')"
                >
                  Process Case
                </a>
              </li>
              <li v-if="props.rowData.stage === 'CASE' 
                        && props.rowData.status === 'Processed'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'PRELIMINARY_REVIEW')"
                >
                  Preliminary Review
                </a>
              </li>
              <li v-if="props.rowData.stage === 'CASE' && props.rowData.status === 'Preliminary_review_completed'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="openActionModal(props.rowData, 'REVIEW_PRELIMINARY_REPORT')"
                >
                  Review Preliminary Report
                </a>
              </li>

              <li v-if="props.rowData.status === 'submitted_to_JSC'">
                <a
                  href="#"
                  class="dropdown-item"
                  @click.prevent="downloadPreliminaryReport(props.rowData)"
                >
                  Download Preliminary Report
                </a>
              </li>
              <!-- Add Hearing Date -->
              <li v-if="props.rowData.status === 'Admitted' || props.rowData.status === 'Adjourned' ">
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

    <!-- Pre register guest modal -->
    <div
      class="modal modal-blur fade"
      id="preRegisterModal"
      tabindex="-1"
      aria-labelledby="preRegisterModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm @guest-pre-registered="handleGuest" />
      </div>
    </div>

        <!-- WalkIn Guest modal -->
    <div class="modal modal-blur fade" id="walkInGuestModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <PreRegisterForm mode="walkIn" @guest-pre-registered="handleWalkInGuest" />
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
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <RecordActions
          v-if="selectedRecord"
          :record="selectedRecord"
          :action="selectedAction"
          @action-completed="handleActionCompleted"
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