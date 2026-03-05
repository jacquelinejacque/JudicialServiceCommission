
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
      options: {
        responsive: true,
        serverSide: true,
        select: true,
        bLengthChange: false,
        bInfo: false,
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        pageLength: 10,
        loading: false,
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
        { title: 'Officer Name', data: 'officerName' },
        { title: 'Designation', data: 'designation' },
        {
            title: 'Date Filed',
            data: 'dateFiled',
            render: (data) => (data ? new Date(data).toLocaleDateString() : '_')
        },
        { title: 'Nature Of Charges', data: 'natureOfCharges' },
        { title: 'Panel', data: 'panel' },
        { title: 'Decision', data: 'decision', render: (data) => (data ? data : '_') },
        { title: 'Status', data: 'status' },
        { title: 'Action', data: null, render: '#action' }
        ]
    }
  },

  mounted() {
    this.dt = this.$refs.table.dt
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
  

  },
  props: []
}
</script>

<template>
  <div class="container-xxl py-3">

    <!-- Card -->
    <div class="card shadow-sm">

      <!-- Card header -->
      <div class="card-header d-flex align-items-center justify-content-between">
        <div>
          <h5 class="card-title mb-0">Disciplinary Records</h5>
          <small class="text-muted">Manage Records, roles and status</small>
        </div>

        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addRecordModal">
          Add Record
        </button>
      </div>

      <!-- Card body -->
      <div class="card-body p-0">
        <div class="table-responsive">
          <DataTable
            ref="table"
            :columns="columns"
            :options="options"
            width="100%"
            class="table table-hover table-striped mb-0"
          >
            <template #action="props">
              <div class="d-flex gap-3 align-items-center">
                <a
                  href="#"
                  class="text-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#editRecordModal"
                  @click.prevent="editRecord(props.rowData)"
                >
                  Edit
                </a>           

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

    <!-- delete user modal -->
    <div
      class="modal fade"
      id="deleteUserModal"
      tabindex="-1"
      aria-labelledby="deleteUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-body d-flex align-items-start justify-content-between">
            <div>
              <h5 class="modal-title mb-1">Delete User</h5>
              <div class="text-muted">Are you sure you want to delete this user?</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn me-auto" data-bs-dismiss="modal">No</button>
            <button type="submit" class="btn btn-primary" @click="deleteUser" :disabled="loading">
              <span v-if="loading">removing...</span>
              <span v-else>Yes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- restore user modal -->
    <div
      class="modal fade"
      id="restoreUserModal"
      tabindex="-1"
      aria-labelledby="restoreUserModalLabel"
      aria-hidden="true"
      data-bs-backdrop="static"
      data-bs-keyboard="false"
    >
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content">
          <div class="modal-body d-flex align-items-start justify-content-between">
            <div>
              <h5 class="modal-title mb-1">Restore User</h5>
              <div class="text-muted">Are you sure you want to restore this user?</div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn me-auto" data-bs-dismiss="modal">No</button>
            <button type="submit" class="btn btn-primary" @click="restoreUser" :disabled="loading">
              <span v-if="loading">restoring...</span>
              <span v-else>Yes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Password Reset modal -->
    <div
      class="modal fade"
      id="resetPasswordModal"
      tabindex="-1"
      aria-labelledby="resetPassword"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <ResetPasswordForm :userId="selectedUserId" />
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